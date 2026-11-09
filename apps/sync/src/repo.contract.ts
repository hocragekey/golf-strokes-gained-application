import { tombstone } from '@golf-sg/shared';
import { expect, it } from 'vitest';
import { decodeCursor, type Cursor, type SyncRepo } from './repo.js';
import { change, ROUND_ID } from './test/fixtures.js';

const start: Cursor = { after: null };
const next = (cursor: string): Cursor => {
  const c = decodeCursor(cursor);
  if (!c) throw new Error('bad cursor');
  return c;
};

/** Behaviour every SyncRepo must share (in-memory and DynamoDB). */
export function repoContract(make: (pageSize?: number) => Promise<SyncRepo> | SyncRepo): void {
  it('stores a change and returns it on pull', async () => {
    const repo = await make();
    expect(await repo.put('alice', change())).toBe('applied');
    const page = await repo.since('alice', start);
    expect(page.changes).toEqual([change()]);
    expect(page.more).toBe(false);
  });

  it('keeps the newest version (last writer wins) and reports stale writes', async () => {
    const repo = await make();
    await repo.put('alice', change('2026-05-02T00:00:00.000Z'));
    expect(await repo.put('alice', change('2026-05-01T00:00:00.000Z'))).toBe('stale');
    expect(await repo.put('alice', change('2026-05-02T00:00:00.000Z'))).toBe('stale');
    expect(await repo.put('alice', change('2026-05-03T00:00:00Z'))).toBe('applied');
    const { changes } = await repo.since('alice', start);
    expect(changes.map((c) => c.updatedAt)).toEqual(['2026-05-03T00:00:00Z']);
  });

  it('replaces a round with a tombstone and never resurrects it from an older copy', async () => {
    const repo = await make();
    await repo.put('alice', change('2026-05-01T00:00:00.000Z'));
    await repo.put('alice', tombstone('round', ROUND_ID, '2026-05-02T00:00:00.000Z'));
    expect(await repo.put('alice', change('2026-05-01T12:00:00.000Z'))).toBe('stale');
    const { changes } = await repo.since('alice', start);
    expect(changes).toEqual([tombstone('round', ROUND_ID, '2026-05-02T00:00:00.000Z')]);
  });

  it('isolates users', async () => {
    const repo = await make();
    await repo.put('alice', change());
    expect((await repo.since('bob', start)).changes).toEqual([]);
    await repo.deleteAll('bob');
    expect((await repo.since('alice', start)).changes).toHaveLength(1);
  });

  it('returns only changes after the cursor (plus a short overlap)', async () => {
    const repo = await make();
    await repo.put('alice', change(undefined, '00000000-0000-4000-8000-000000000001'));
    const first = await repo.since('alice', start);
    await repo.put('alice', change(undefined, '00000000-0000-4000-8000-000000000002'));
    const second = await repo.since('alice', next(first.cursor));
    expect(second.changes.map((c) => c.id)).toContain('00000000-0000-4000-8000-000000000002');
    const empty = await repo.since('alice', { after: '2099-01-01T00:00:00.000Z' });
    expect(empty.changes).toEqual([]);
  });

  it('pages through large feeds without skipping or repeating', async () => {
    const repo = await make(2);
    const ids = Array.from(
      { length: 5 },
      (_, i) => `00000000-0000-4000-8000-00000000000${String(i + 1)}`,
    );
    for (const id of ids) await repo.put('alice', change(undefined, id));
    const seen: string[] = [];
    let cursor = start;
    for (let i = 0; i < 10; i++) {
      const page = await repo.since('alice', cursor);
      seen.push(...page.changes.map((c) => c.id));
      cursor = next(page.cursor);
      if (!page.more) break;
    }
    expect(seen.sort()).toEqual(ids);
  });

  it('deletes all of a user', async () => {
    const repo = await make();
    for (let i = 1; i <= 30; i++) {
      await repo.put(
        'alice',
        change(undefined, `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`),
      );
    }
    await repo.deleteAll('alice');
    expect((await repo.since('alice', start)).changes).toEqual([]);
  });
}
