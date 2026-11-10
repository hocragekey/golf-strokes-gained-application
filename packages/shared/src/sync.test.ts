import { describe, expect, it } from 'vitest';
import {
  changeProblem,
  changeSchema,
  courseChange,
  isNewer,
  pushRequestSchema,
  roundChange,
  tombstone,
  MAX_PUSH_CHANGES,
} from './sync.js';
import { course, entry, round } from './test/fixtures.js';

const ID = '9b2f7c1e-3d4a-4b5c-8d6e-7f8091a2b3c4';
const good = () =>
  round(ID, '2026-05-01', [entry({ teeResult: 'fairway', approachYards: 150, firstPuttFeet: 20 })]);

describe('sync protocol', () => {
  it('round-trips round, course and tombstone changes through the schema', () => {
    for (const change of [
      roundChange(good()),
      courseChange(course),
      tombstone('round', ID, '2026-05-02T10:00:00.000Z'),
    ]) {
      expect(changeSchema.parse(JSON.parse(JSON.stringify(change)))).toEqual(change);
    }
  });

  it('accepts valid changes', () => {
    expect(changeProblem(roundChange(good()))).toBeNull();
    expect(changeProblem(courseChange(course))).toBeNull();
    expect(changeProblem(tombstone('course', course.id, course.updatedAt))).toBeNull();
  });

  it('rejects inconsistent changes', () => {
    const r = good();
    expect(changeProblem({ ...roundChange(r), id: course.id })).toMatch(/id/);
    expect(changeProblem({ ...roundChange(r), updatedAt: '2030-01-01T00:00:00.000Z' })).toMatch(
      /updatedAt/,
    );
    expect(changeProblem({ ...roundChange(r), data: undefined })).toMatch(/Missing/);
    expect(changeProblem({ ...roundChange(r), deletedAt: r.updatedAt })).toMatch(/tombstone/);
  });

  it('rejects rounds the app could not display', () => {
    const r = good();
    const misnumbered = { ...r, layout: r.layout.map((h) => ({ ...h, number: h.number + 1 })) };
    expect(changeProblem(roundChange(misnumbered))).toMatch(/numbered/);
    expect(changeProblem(roundChange({ ...r, layout: [] }))).toMatch(/par and yardage/);
    const badScore = { ...r, holes: r.holes.map((h) => ({ ...h, score: 1 })) };
    expect(changeProblem(roundChange(badScore))).not.toBeNull();
  });

  it('limits a push batch', () => {
    const changes = Array.from({ length: MAX_PUSH_CHANGES + 1 }, () => roundChange(good()));
    expect(pushRequestSchema.safeParse({ changes }).success).toBe(false);
  });

  it('resolves conflicts by last writer wins, keeping the current copy on ties', () => {
    expect(isNewer('2026-05-02T00:00:00Z', undefined)).toBe(true);
    expect(isNewer('2026-05-02T00:00:00Z', '2026-05-01T23:59:59.999Z')).toBe(true);
    expect(isNewer('2026-05-02T00:00:00Z', '2026-05-02T00:00:00.000Z')).toBe(false);
    expect(isNewer('2026-05-01T00:00:00Z', '2026-05-02T00:00:00Z')).toBe(false);
  });
});
