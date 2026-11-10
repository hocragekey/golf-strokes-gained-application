import { tombstone, type PullResponse, type PushResponse } from '@golf-sg/shared';
import { describe, expect, it } from 'vitest';
import { handle, type SyncRequest } from './handler.js';
import { handler, type HttpApiEvent } from './lambda.js';
import { MemoryRepo } from './memory-repo.js';
import { change, round, ROUND_ID, tickingClock } from './test/fixtures.js';

const req = (r: Partial<SyncRequest>): SyncRequest => ({
  method: 'GET',
  path: '/api/sync',
  query: {},
  body: undefined,
  userId: 'alice',
  ...r,
});
const push = (body: unknown, userId = 'alice') =>
  req({ method: 'POST', body: JSON.stringify(body), userId });

describe('sync handler', () => {
  it('pushes and pulls a golfer’s changes', async () => {
    const repo = new MemoryRepo(tickingClock());
    const pushed = await handle(push({ changes: [change()] }), repo);
    expect(pushed).toEqual({ status: 200, body: { applied: [ROUND_ID], stale: [], rejected: [] } });
    const pulled = await handle(req({}), repo);
    expect(pulled.status).toBe(200);
    expect((pulled.body as PullResponse).changes).toEqual([change()]);
  });

  it('never shows one golfer’s rounds to another', async () => {
    const repo = new MemoryRepo(tickingClock());
    await handle(push({ changes: [change()] }), repo);
    const pulled = await handle(req({ userId: 'bob' }), repo);
    expect((pulled.body as PullResponse).changes).toEqual([]);
  });

  it('reports stale and invalid changes without failing the batch', async () => {
    const repo = new MemoryRepo(tickingClock());
    await handle(push({ changes: [change('2026-05-03T00:00:00.000Z')] }), repo);
    const bad = round();
    const res = await handle(
      push({
        changes: [
          change('2026-05-02T00:00:00.000Z'),
          {
            kind: 'round',
            id: '00000000-0000-4000-8000-000000000009',
            updatedAt: bad.updatedAt,
            deletedAt: null,
            data: bad,
          },
          tombstone('course', '00000000-0000-4000-8000-000000000003', '2026-05-01T00:00:00.000Z'),
        ],
      }),
      repo,
    );
    const body = res.body as PushResponse;
    expect(body.stale).toEqual([ROUND_ID]);
    expect(body.rejected).toEqual([
      { id: '00000000-0000-4000-8000-000000000009', reason: expect.stringMatching(/id/) as string },
    ]);
    expect(body.applied).toEqual(['00000000-0000-4000-8000-000000000003']);
  });

  it('rejects malformed requests', async () => {
    const repo = new MemoryRepo();
    expect((await handle(req({ method: 'POST', body: '{nope' }), repo)).status).toBe(400);
    expect((await handle(push({ changes: [{ kind: 'hole' }] }), repo)).status).toBe(400);
    expect((await handle(req({ query: { since: 'not-a-cursor' } }), repo)).status).toBe(400);
    expect((await handle(req({ path: '/api/rounds' }), repo)).status).toBe(404);
    expect((await handle(req({ userId: '' }), repo)).status).toBe(401);
  });

  it('deletes all account data', async () => {
    const repo = new MemoryRepo(tickingClock());
    await handle(push({ changes: [change()] }), repo);
    expect(await handle(req({ method: 'DELETE', path: '/api/account' }), repo)).toEqual({
      status: 204,
    });
    expect(((await handle(req({}), repo)).body as PullResponse).changes).toEqual([]);
  });
});

describe('lambda adapter', () => {
  const event = (claims?: Record<string, unknown>): HttpApiEvent => ({
    rawPath: '/api/sync',
    body: Buffer.from(JSON.stringify({ changes: [] })).toString('base64'),
    isBase64Encoded: true,
    requestContext: {
      http: { method: 'POST' },
      authorizer: claims ? { jwt: { claims } } : undefined,
    },
  });

  it('uses the verified sub from the JWT authorizer', async () => {
    const res = await handler(event({ sub: '1234567890', iss: 'https://accounts.google.com' }));
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(JSON.parse(res.body)).toEqual({ applied: [], stale: [], rejected: [] });
  });

  it('refuses requests without a verified identity', async () => {
    expect((await handler(event())).statusCode).toBe(401);
  });
});
