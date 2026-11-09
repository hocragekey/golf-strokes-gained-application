import { describe, expect, it } from 'vitest';
import { courseInput, par3ThreePutt, par4, roundInput } from '../test/fixtures';
import { createTestStore } from '../test/render';
import { GolfDb } from './db';
import { LocalStore, StoreError } from './store';

async function seed() {
  const store = createTestStore();
  const detail = await store.saveRound(roundInput([par4, par3ThreePutt]));
  return { store, detail };
}

describe('LocalStore', () => {
  it('saves a round without any course setup', async () => {
    const store = createTestStore();
    const detail = await store.saveRound({
      ...roundInput([par4]),
      courseName: '',
      tees: '',
    });
    expect(detail.summary).toMatchObject({ courseName: '', holesPlayed: 1 });
    expect(await store.db.courses.count()).toBe(0);
  });

  it('computes strokes gained for saved rounds', async () => {
    const { detail } = await seed();
    expect(detail.summary).toMatchObject({ score: 8, toPar: 1, holesPlayed: 2 });
    expect(detail.holes).toHaveLength(2);
    expect(detail.summary.sg.putting).toBeLessThan(0);
  });

  it('computes stats and rounds against a chosen baseline', async () => {
    const { store, detail } = await seed();
    const tour = await store.getStats();
    const scratch = await store.getStats(undefined, 'scratch');
    expect(scratch.baseline).toBe('Scratch (est.)');
    expect(scratch.sgPer18.total).toBeGreaterThan(tour.sgPer18.total);
    const round = await store.getRound(detail.round.id, 'scratch');
    expect(round.summary.sg.total).toBeGreaterThan(detail.summary.sg.total);
    const [listed] = await store.listRounds('scratch');
    expect(listed?.sg.total).toBe(round.summary.sg.total);
  });

  it('validates rounds against their par and yardage', async () => {
    const { store } = await seed();
    const bad = { ...par4, firstPuttFeet: null };
    await expect(store.saveRound(roundInput([bad]))).rejects.toThrow(/Scorecard has errors/);
    await expect(store.saveRound({ ...roundInput([par4]), layout: [] })).rejects.toBeInstanceOf(
      StoreError,
    );
    await expect(store.saveRound(roundInput([par4]), 'missing')).rejects.toThrow('Round not found');
    await expect(store.getRound('missing')).rejects.toThrow('Round not found');
  });

  it('updates rounds and keeps them newest first', async () => {
    const { store, detail } = await seed();
    await store.saveRound({ ...roundInput([par4]), playedOn: '2026-06-01' });
    const updated = await store.saveRound(
      { ...roundInput([par4]), playedOn: '2026-04-01', notes: 'edited' },
      detail.round.id,
    );
    expect(updated.round).toMatchObject({ id: detail.round.id, notes: 'edited' });
    expect((await store.listRounds()).map((r) => r.playedOn)).toEqual(['2026-06-01', '2026-04-01']);
    expect((await store.getStats(1)).rounds).toBe(1);
    expect((await store.getStats()).rounds).toBe(2);
  });

  it('exports all data as a versioned JSON document', async () => {
    const { store } = await seed();
    const backup = await store.exportBackup();
    expect(backup).toMatchObject({ app: 'golf-strokes-gained', version: 2, courses: [] });
    expect(backup.rounds).toHaveLength(1);
  });

  it('migrates v1 databases so existing rounds keep working', async () => {
    const name = `test-${crypto.randomUUID()}`;
    const { Dexie } = await import('dexie');
    const legacy = new Dexie(name);
    legacy.version(1).stores({ courses: 'id, name', rounds: 'id, courseId, playedOn' });
    const at = '2026-01-01T00:00:00.000Z';
    const courseId = crypto.randomUUID();
    await legacy
      .table('courses')
      .add({ id: courseId, ...courseInput, tees: 'White', createdAt: at, updatedAt: at });
    await legacy.table('rounds').add({
      id: crypto.randomUUID(),
      courseId,
      playedOn: '2026-05-01',
      notes: '',
      holes: [
        {
          ...par4,
          approachLie: 'fairway',
          missDirection: null,
          shortGameShots: 0,
          shortGameYards: null,
          shortGameLie: null,
          penalties: 0,
        },
      ],
      createdAt: at,
      updatedAt: at,
    });
    legacy.close();

    const store = new LocalStore(new GolfDb(name));
    const [summary] = await store.listRounds();
    expect(summary).toMatchObject({ courseName: 'Pebble Creek', holesPlayed: 1 });
    const [stored] = await store.db.rounds.toArray();
    expect(stored).not.toHaveProperty('courseId');
    expect(stored?.layout).toEqual([courseInput.holes[0]]);
  });
});
