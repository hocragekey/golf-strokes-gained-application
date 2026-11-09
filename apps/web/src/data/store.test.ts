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
    expect(await store.listCourses()).toEqual([]);
  });

  it('remembers the course layout from a named round to pre-fill the next one', async () => {
    const { store } = await seed();
    const [saved] = await store.listCourses();
    expect(saved).toMatchObject({ name: 'Pebble Creek', tees: 'White' });
    // A 2-hole round can't form a 9/18-hole course, so only the played holes are kept.
    expect(saved?.holes).toHaveLength(2);
    expect(await store.findCourse('pebble creek', 'white')).toEqual(saved);
    expect(await store.findCourse('Pebble Creek', 'Blue')).toEqual(saved);
    expect(await store.findCourse('')).toBeUndefined();

    await store.saveCourse(courseInput, saved?.id);
    await store.saveRound(roundInput([{ ...par4, score: 5, putts: 3 }]));
    const [merged] = await store.listCourses();
    expect(merged?.holes).toHaveLength(9);
    expect(await store.listCourses()).toHaveLength(1);
  });

  it('manages saved courses independently of rounds', async () => {
    const { store, detail } = await seed();
    const [course] = await store.listCourses();
    const updated = await store.saveCourse({ ...courseInput, name: 'Pebble North' }, course?.id);
    expect(updated.createdAt).toBe(course?.createdAt);
    await store.deleteCourse(updated.id);
    expect(await store.listCourses()).toEqual([]);
    expect((await store.getRound(detail.round.id)).summary.courseName).toBe('Pebble Creek');
    await expect(store.getCourse(crypto.randomUUID())).rejects.toThrow('Course not found');
    await expect(store.saveCourse({ ...courseInput, name: '' })).rejects.toBeInstanceOf(StoreError);
    expect((await store.saveCourse(courseInput)).name).toBe('Pebble Creek');
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

  it('exports and imports backups', async () => {
    const { store } = await seed();
    const backup = await store.exportBackup();
    expect(backup.version).toBe(2);
    const other = createTestStore();
    expect(await other.importBackup(JSON.parse(JSON.stringify(backup)))).toEqual({
      courses: 1,
      rounds: 1,
    });
    expect(await other.listRounds()).toHaveLength(1);
  });

  it('imports v1 backups by copying each course layout into its rounds', async () => {
    const store = createTestStore();
    const at = '2026-01-01T00:00:00.000Z';
    const course = {
      id: crypto.randomUUID(),
      ...courseInput,
      tees: 'White',
      createdAt: at,
      updatedAt: at,
    };
    const round = {
      id: crypto.randomUUID(),
      courseId: course.id,
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
    };
    const v1 = {
      app: 'golf-strokes-gained',
      version: 1,
      exportedAt: at,
      courses: [course],
      rounds: [round],
    };
    expect(await store.importBackup(v1)).toEqual({ courses: 1, rounds: 1 });
    const [summary] = await store.listRounds();
    expect(summary).toMatchObject({ courseName: 'Pebble Creek', holesPlayed: 1 });
    await expect(store.importBackup({ ...v1, courses: [] })).rejects.toThrow('missing course');
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

  it('rejects invalid backups without touching data', async () => {
    const { store } = await seed();
    const backup = await store.exportBackup();
    await expect(store.importBackup({ app: 'other' })).rejects.toBeInstanceOf(StoreError);
    const broken = structuredClone(backup);
    const firstHole = broken.rounds[0]?.holes[0];
    if (firstHole) firstHole.firstPuttFeet = null;
    await expect(store.importBackup(broken)).rejects.toThrow('is invalid');
    const short = structuredClone(backup);
    if (short.rounds[0]) short.rounds[0].layout = short.rounds[0].layout.slice(0, 1);
    await expect(store.importBackup(short)).rejects.toThrow('is invalid');
    const empty = structuredClone(backup);
    if (empty.rounds[0]) empty.rounds[0].holes = [];
    await expect(store.importBackup(empty)).rejects.toBeInstanceOf(StoreError);
    expect(await store.listRounds()).toHaveLength(1);
  });

  it('rejects a backup whose holes and layout are misnumbered', async () => {
    const store = createTestStore();
    await store.saveRound(roundInput([par4]));
    const backup = await store.exportBackup();
    const [round] = backup.rounds;
    if (!round?.layout[0]) throw new Error('expected a round');
    round.layout[0].number = 2;
    await expect(store.importBackup(backup)).rejects.toThrow(/invalid/);
  });

  it('keeps unplayed holes of a partial saved course and lets it be edited', async () => {
    const store = createTestStore();
    await store.saveRound(roundInput([par4, par3ThreePutt]));
    await store.saveRound(roundInput([par4]));
    const [course] = await store.listCourses();
    expect(course?.holes).toHaveLength(2);
    if (!course) throw new Error('expected a course');
    const edited = await store.saveCourse({ ...course, name: 'Pebble Creek GC' }, course.id);
    expect(edited.holes).toHaveLength(2);
  });
});
