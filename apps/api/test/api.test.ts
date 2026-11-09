import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp } from './helpers.js';

type TestApp = Awaited<ReturnType<typeof createTestApp>>;

describe('API', () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('reports liveness and readiness with security headers', async () => {
    const health = await app.server.inject('/api/health');
    expect(health.json()).toEqual({ status: 'ok' });
    expect(health.headers['x-content-type-options']).toBe('nosniff');
    expect((await app.server.inject('/api/ready')).json()).toEqual({ status: 'ready' });
  });

  it('returns JSON 404s for unknown API routes', async () => {
    const res = await app.server.inject('/api/nope');
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: 'NotFound' });
  });

  it.each(['/api/courses', '/api/rounds', '/api/stats'])(
    'does not expose scorecard data endpoints (%s)',
    async (url) => {
      for (const method of ['GET', 'POST'] as const) {
        const res = await app.server.inject({ method, url });
        expect(res.statusCode).toBe(404);
      }
    },
  );
});

describe('static web assets', () => {
  it('serves the SPA with history fallback while keeping API 404s', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'golf-sg-web-'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>Strokes Gained</title>');
    const app = await createTestApp({ webDistDir: dir });

    const deepLink = await app.server.inject('/rounds/1');
    expect(deepLink.statusCode).toBe(200);
    expect(deepLink.body).toContain('Strokes Gained');
    expect((await app.server.inject('/api/missing')).statusCode).toBe(404);
    expect((await app.server.inject({ method: 'POST', url: '/missing' })).statusCode).toBe(404);
    await app.close();
  });

  it('falls back to health checks only when assets are missing', async () => {
    const app = await createTestApp({ webDistDir: join(tmpdir(), 'does-not-exist-golf-sg') });
    expect((await app.server.inject('/')).statusCode).toBe(404);
    expect((await app.server.inject('/api/health')).statusCode).toBe(200);
    await app.close();
  });
});
