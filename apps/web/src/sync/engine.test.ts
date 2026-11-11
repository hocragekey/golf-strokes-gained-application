import { changeKey } from '@golf-sg/shared';
import { describe, expect, it } from 'vitest';
import { createTestStore } from '../test/render';
import { par4, roundInput } from '../test/fixtures';
import { fakeServer } from '../test/fake-server';
import type { SyncApi } from './api';
import { SyncEngine } from './engine';

const tick = () => new Promise((r) => setTimeout(r, 5));

function device(api: SyncApi) {
  const store = createTestStore();
  return { store, engine: new SyncEngine(store.db, api) };
}

describe('LocalStore outbox', () => {
  it('records saves, course shortcuts and deletes as pending changes', async () => {
    const { store } = device(fakeServer().api);
    const id = (await store.saveRound(roundInput([par4]))).round.id;
    const pending = await store.db.pending.toArray();
    expect(pending.map((p) => p.kind).sort()).toEqual(['round']);
    await store.deleteRound(id);
    expect((await store.db.pending.get(changeKey('round', id)))?.deleted).toBe(true);
  });
});

describe('SyncEngine', () => {
  it('uploads existing rounds on first sign-in and pulls them on another device', async () => {
    const { api, items } = fakeServer();
    const a = device(api);
    const id = (await a.store.saveRound(roundInput([par4]))).round.id;
    await a.store.db.pending.clear(); // as if saved long before signing in
    await a.engine.adopt('alice');
    await a.engine.run();
    expect(items.has(changeKey('round', id))).toBe(true);
    expect(await a.engine.pendingCount()).toBe(0);

    const b = device(api);
    await b.engine.adopt('alice');
    const result = await b.engine.run();
    expect(result.pulled).toBe(1);
    expect(await b.store.db.rounds.get(id)).toBeDefined();
  });

  it('propagates deletes so stale devices do not resurrect them', async () => {
    const { api } = fakeServer();
    const a = device(api);
    const b = device(api);
    await a.engine.adopt('alice');
    await b.engine.adopt('alice');
    const id = (await a.store.saveRound(roundInput([par4]))).round.id;
    await a.engine.run();
    await b.engine.run();
    await tick();
    await b.store.deleteRound(id);
    await b.engine.run();
    await a.engine.run();
    expect(await a.store.db.rounds.get(id)).toBeUndefined();
    await a.engine.run();
    expect(await a.store.db.rounds.get(id)).toBeUndefined();
  });

  it('keeps the latest edit when two devices change the same round', async () => {
    const { api } = fakeServer();
    const a = device(api);
    const b = device(api);
    await a.engine.adopt('alice');
    await b.engine.adopt('alice');
    const id = (await a.store.saveRound(roundInput([par4]))).round.id;
    await a.engine.run();
    await b.engine.run();
    await tick();
    await a.store.saveRound({ ...roundInput([par4]), notes: 'older' }, id);
    await tick();
    await b.store.saveRound({ ...roundInput([par4]), notes: 'newer' }, id);
    await b.engine.run();
    await a.engine.run(); // a's older edit is stale on push and replaced on pull
    expect((await a.store.db.rounds.get(id))?.notes).toBe('newer');
  });

  it('does not overwrite a newer local edit that is still waiting to upload', async () => {
    const { api } = fakeServer();
    const a = device(api);
    await a.engine.adopt('alice');
    const id = (await a.store.saveRound(roundInput([par4]))).round.id;
    await a.engine.run();
    await tick();
    await a.store.saveRound({ ...roundInput([par4]), notes: 'offline edit' }, id);
    const pull = await api.pull(undefined);
    const engine = new SyncEngine(a.store.db, {
      ...api,
      push: () => Promise.reject(new Error('offline')),
      pull: () => Promise.resolve(pull),
    });
    await expect(engine.run()).rejects.toThrow('offline');
    expect((await a.store.db.rounds.get(id))?.notes).toBe('offline edit');
    expect(await a.engine.pendingCount()).toBeGreaterThan(0);
  });

  it("never uploads one account's leftovers into another account", async () => {
    const { api } = fakeServer();
    const a = device(api);
    await a.store.saveRound(roundInput([par4]));
    await a.engine.adopt('alice');
    await a.engine.adopt('bob');
    expect(await a.store.db.rounds.count()).toBe(0);
    expect(await a.engine.pendingCount()).toBe(0);
    expect(await a.engine.meta('cursor')).toBeUndefined();
  });

  it('keeps rounds saved while signed out when another account adopts the leftovers', async () => {
    const { api } = fakeServer();
    const a = device(api);
    await a.engine.adopt('alice');
    await a.store.saveRound(roundInput([par4]));
    await a.engine.signOut();
    const mine = await a.store.saveRound(roundInput([par4]));
    await a.engine.adopt('bob');
    expect((await a.store.db.rounds.toArray()).map((r) => r.id)).toEqual([mine.round.id]);
    expect(await a.engine.pendingCount()).toBe(1);
  });

  it('signs out keeping only unsent data, or clearing everything once uploaded', async () => {
    const { api } = fakeServer();
    const a = device(api);
    await a.store.saveRound(roundInput([par4]));
    await a.engine.adopt('alice');
    await a.engine.run();
    const unsent = await a.store.saveRound(roundInput([par4]));
    await a.engine.signOut();
    expect((await a.store.db.rounds.toArray()).map((r) => r.id)).toEqual([unsent.round.id]);
    expect(await a.engine.meta('syncedSub')).toBe('alice');
    expect(await a.engine.meta('cursor')).toBeUndefined();
    await a.engine.adopt('alice');
    await a.engine.run();
    expect(await a.store.db.rounds.count()).toBe(2);
    await a.engine.signOut();
    expect(await a.store.db.rounds.count()).toBe(0);
    expect(await a.engine.meta('syncedSub')).toBeUndefined();
  });
});
