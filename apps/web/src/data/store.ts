import {
  computeStats,
  getBaseline,
  courseInputSchema,
  courseSchema,
  roundInputSchema,
  roundIssues,
  roundSchema,
  summarizeRound,
  type Course,
  type CourseHole,
  type CourseInput,
  type EntryIssue,
  type Round,
  type RoundDetail,
  type RoundInput,
  type RoundSummary,
  type Stats,
} from '@golf-sg/shared';
import { z, type ZodType } from 'zod';
import { GolfDb } from './db';
import { backupV1Schema, roundFromV1 } from './legacy';

export class StoreError extends Error {
  constructor(
    message: string,
    readonly issues: EntryIssue[] = [],
  ) {
    super(issues.length > 0 ? `${message}: ${issues.map((i) => i.message).join('; ')}` : message);
    this.name = 'StoreError';
  }
}

export const BACKUP_VERSION = 2;

export const backupSchema = z.object({
  app: z.literal('golf-strokes-gained'),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.iso.datetime(),
  courses: z.array(courseSchema),
  rounds: z.array(roundSchema),
});
export type Backup = z.infer<typeof backupSchema>;

function parse<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  throw new StoreError(
    'Invalid data',
    result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
  );
}

const now = (): string => new Date().toISOString();

const newestFirst = (a: Round, b: Round): number =>
  b.playedOn.localeCompare(a.playedOn) || b.createdAt.localeCompare(a.createdAt);

const sameCourse = (c: Pick<Course, 'name' | 'tees'>, name: string, tees: string): boolean =>
  c.name.trim().toLowerCase() === name.trim().toLowerCase() &&
  c.tees.trim().toLowerCase() === tees.trim().toLowerCase();

/** A round is usable once every played hole has a par and yardage. */
const isComplete = (r: Round): boolean => r.layout.length === r.holes.length;

/** Keeps holes the round didn't play (e.g. the back nine) from the previously saved layout. */
function mergeLayout(saved: readonly CourseHole[], played: readonly CourseHole[]): CourseHole[] {
  const holes = [...played, ...saved.slice(played.length)];
  return holes.length === 9 || holes.length === 18 ? holes : [...played];
}

/**
 * Local-first data access. Everything (validation, strokes gained, stats) runs on the device,
 * so the app works without a network connection.
 */
export class LocalStore {
  constructor(readonly db: GolfDb = new GolfDb()) {}

  listCourses(): Promise<Course[]> {
    return this.db.courses.orderBy('name').toArray();
  }

  async getCourse(id: string): Promise<Course> {
    const course = await this.db.courses.get(id);
    if (!course) throw new StoreError('Course not found');
    return course;
  }

  /** Finds a saved layout by name and tees (case-insensitive) to pre-fill a new round. */
  async findCourse(name: string, tees = ''): Promise<Course | undefined> {
    if (name.trim() === '') return undefined;
    const courses = await this.db.courses.toArray();
    return (
      courses.find((c) => sameCourse(c, name, tees)) ??
      courses.find((c) => sameCourse(c, name, c.tees))
    );
  }

  async saveCourse(input: CourseInput, id?: string): Promise<Course> {
    const data = parse(courseInputSchema, input);
    if (id === undefined) {
      const course: Course = {
        id: crypto.randomUUID(),
        ...data,
        createdAt: now(),
        updatedAt: now(),
      };
      await this.db.courses.add(course);
      return course;
    }
    const course: Course = { ...(await this.getCourse(id)), ...data, updatedAt: now() };
    await this.db.courses.put(course);
    return course;
  }

  /** Saved courses are only shortcuts: rounds keep their own par and yardage. */
  async deleteCourse(id: string): Promise<void> {
    await this.db.courses.delete(id);
  }

  private async rounds(limit?: number): Promise<Round[]> {
    return (await this.db.rounds.toArray()).filter(isComplete).sort(newestFirst).slice(0, limit);
  }

  async listRounds(baselineId?: string): Promise<RoundSummary[]> {
    const baseline = getBaseline(baselineId);
    return (await this.rounds()).map((round) => {
      const { holeSg: _holeSg, ...summary } = summarizeRound(round, baseline);
      return summary;
    });
  }

  async getRound(id: string, baselineId?: string): Promise<RoundDetail> {
    const round = await this.db.rounds.get(id);
    if (!round || !isComplete(round)) throw new StoreError('Round not found');
    const { holeSg, ...summary } = summarizeRound(round, getBaseline(baselineId));
    return { round, summary, holes: holeSg };
  }

  /** Saves the round and remembers its course layout so the next round there is pre-filled. */
  async saveRound(input: RoundInput, id?: string): Promise<RoundDetail> {
    const data = parse(roundInputSchema, input);
    const issues = roundIssues(data.holes, data.layout);
    if (issues.length > 0) throw new StoreError('Scorecard has errors', issues);

    const roundId = await this.db.transaction('rw', this.db.courses, this.db.rounds, async () => {
      const existing = id === undefined ? undefined : await this.db.rounds.get(id);
      if (id !== undefined && !existing) throw new StoreError('Round not found');
      const round: Round = {
        id: existing?.id ?? crypto.randomUUID(),
        ...data,
        createdAt: existing?.createdAt ?? now(),
        updatedAt: now(),
      };
      await this.db.rounds.put(round);

      if (data.courseName !== '') {
        const saved = (await this.db.courses.toArray()).find((c) =>
          sameCourse(c, data.courseName, data.tees),
        );
        const holes = mergeLayout(saved?.holes ?? [], data.layout);
        await this.db.courses.put({
          id: saved?.id ?? crypto.randomUUID(),
          name: data.courseName,
          tees: data.tees,
          holes,
          createdAt: saved?.createdAt ?? now(),
          updatedAt: now(),
        });
      }
      return round.id;
    });
    return this.getRound(roundId);
  }

  async deleteRound(id: string): Promise<void> {
    await this.db.rounds.delete(id);
  }

  async getStats(limit?: number, baselineId?: string): Promise<Stats> {
    return computeStats(await this.rounds(limit), getBaseline(baselineId));
  }

  async exportBackup(): Promise<Backup> {
    const [courses, rounds] = await Promise.all([
      this.db.courses.toArray(),
      this.db.rounds.toArray(),
    ]);
    return {
      app: 'golf-strokes-gained',
      version: BACKUP_VERSION,
      exportedAt: now(),
      courses,
      rounds,
    };
  }

  /** Replaces all local data with the backup (v1 or v2) after validating it end to end. */
  async importBackup(data: unknown): Promise<{ courses: number; rounds: number }> {
    const backup = this.upgradeBackup(data);
    for (const round of backup.rounds) {
      const issues = roundIssues(round.holes, round.layout);
      if (round.layout.length !== round.holes.length || issues.length > 0) {
        throw new StoreError(`Round ${round.playedOn} is invalid`, issues);
      }
    }
    await this.db.transaction('rw', this.db.courses, this.db.rounds, async () => {
      await Promise.all([this.db.courses.clear(), this.db.rounds.clear()]);
      await this.db.courses.bulkPut(backup.courses);
      await this.db.rounds.bulkPut(backup.rounds);
    });
    return { courses: backup.courses.length, rounds: backup.rounds.length };
  }

  private upgradeBackup(data: unknown): Backup {
    const v1 = backupV1Schema.safeParse(data);
    if (!v1.success) return parse(backupSchema, data);
    const courses = new Map(v1.data.courses.map((c) => [c.id, c]));
    const rounds = v1.data.rounds.map((round) => {
      const course = courses.get(round.courseId);
      if (!course) throw new StoreError(`Round ${round.playedOn} references a missing course`);
      return roundFromV1(round, course);
    });
    return { ...v1.data, version: BACKUP_VERSION, rounds };
  }
}
