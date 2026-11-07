import { describe, expect, it } from 'vitest';
import { courseInput, par3ThreePutt, par4 } from '../test/fixtures';
import { createTestStore } from '../test/render';
import { StoreError } from './store';

async function seed() {
  const store = createTestStore();
  const course = await store.saveCourse(courseInput);
  const detail = await store.saveRound({
    courseId: course.id,
    playedOn: '2026-05-01',
    holes: [par4, par3ThreePutt],
  });
  return { store, course, detail };
}

describe('LocalStore', () => {
  it('creates, updates and lists courses', async () => {
    const { store, course } = await seed();
    expect(course.id).toMatch(/^[0-9a-f-]{36}$/);
    const updated = await store.saveCourse(
      { ...courseInput, name: 'Pebble Creek North' },
      course.id,
    );
    expect(updated.createdAt).toBe(course.createdAt);
    expect((await store.listCourses()).map((c) => c.name)).toEqual(['Pebble Creek North']);
    await expect(store.getCourse(crypto.randomUUID())).rejects.toThrow('Course not found');
  });

  it('rejects invalid courses', async () => {
    const store = createTestStore();
    await expect(store.saveCourse({ ...courseInput, name: '' })).rejects.toBeInstanceOf(StoreError);
  });

  it('protects courses that have rounds', async () => {
    const { store, course, detail } = await seed();
    await expect(store.deleteCourse(course.id)).rejects.toThrow('recorded rounds');
    await expect(
      store.saveCourse({ ...courseInput, holes: courseInput.holes.slice(0, 1) }, course.id),
    ).rejects.toThrow();
    const par3First = courseInput.holes.map((h) => (h.number === 1 ? { ...h, par: 3 } : h));
    await expect(store.saveCourse({ ...courseInput, holes: par3First }, course.id)).rejects.toThrow(
      'conflicts with the round played 2026-05-01',
    );
    await store.deleteRound(detail.round.id);
    await store.deleteCourse(course.id);
    expect(await store.listCourses()).toEqual([]);
  });

  it('computes strokes gained for saved rounds', async () => {
    const { detail } = await seed();
    expect(detail.summary).toMatchObject({ score: 8, toPar: 1, holesPlayed: 2 });
    expect(detail.holes).toHaveLength(2);
    expect(detail.summary.sg.putting).toBeLessThan(0);
  });

  it('validates rounds against the course', async () => {
    const { store, course } = await seed();
    const bad = { ...par4, firstPuttFeet: null };
    await expect(
      store.saveRound({ courseId: course.id, playedOn: '2026-05-02', holes: [bad] }),
    ).rejects.toThrow(/Scorecard has errors/);
    await expect(
      store.saveRound({ courseId: course.id, playedOn: '2026-05-02', holes: [par4] }, 'missing'),
    ).rejects.toThrow('Round not found');
  });

  it('updates rounds and keeps them newest first', async () => {
    const { store, course, detail } = await seed();
    await store.saveRound({ courseId: course.id, playedOn: '2026-06-01', holes: [par4] });
    const updated = await store.saveRound(
      { courseId: course.id, playedOn: '2026-04-01', notes: 'edited', holes: [par4] },
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
    const other = createTestStore();
    expect(await other.importBackup(JSON.parse(JSON.stringify(backup)))).toEqual({
      courses: 1,
      rounds: 1,
    });
    expect(await other.listRounds()).toHaveLength(1);
  });

  it('rejects invalid backups without touching data', async () => {
    const { store } = await seed();
    const backup = await store.exportBackup();
    await expect(store.importBackup({ app: 'other' })).rejects.toBeInstanceOf(StoreError);
    await expect(store.importBackup({ ...backup, courses: [] })).rejects.toThrow('missing course');
    const broken = structuredClone(backup);
    const firstHole = broken.rounds[0]?.holes[0];
    if (firstHole) firstHole.firstPuttFeet = null;
    await expect(store.importBackup(broken)).rejects.toThrow('is invalid');
    const empty = structuredClone(backup);
    if (empty.rounds[0]) empty.rounds[0].holes = [];
    await expect(store.importBackup(empty)).rejects.toBeInstanceOf(StoreError);
    expect(await store.listRounds()).toHaveLength(1);
  });
});
