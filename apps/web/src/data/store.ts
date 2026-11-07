import {
  computeStats,
  courseInputSchema,
  courseSchema,
  roundInputSchema,
  roundIssues,
  roundSchema,
  summarizeRound,
  type Course,
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

export class StoreError extends Error {
  constructor(
    message: string,
    readonly issues: EntryIssue[] = [],
  ) {
    super(issues.length > 0 ? `${message}: ${issues.map((i) => i.message).join('; ')}` : message);
    this.name = 'StoreError';
  }
}

export const BACKUP_VERSION = 1;

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

  async saveCourse(input: CourseInput, id?: string): Promise<Course> {
    const data = parse(courseInputSchema, input);
    return this.db.transaction('rw', this.db.courses, this.db.rounds, async () => {
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
      const existing = await this.getCourse(id);
      const rounds = await this.db.rounds.where('courseId').equals(id).toArray();
      const maxHole = Math.max(0, ...rounds.map((r) => r.holes.length));
      if (data.holes.length < maxHole) {
        throw new StoreError(`Rounds on this course record ${maxHole} holes`);
      }
      const course: Course = { ...existing, ...data, updatedAt: now() };
      await this.db.courses.put(course);
      return course;
    });
  }

  async deleteCourse(id: string): Promise<void> {
    await this.db.transaction('rw', this.db.courses, this.db.rounds, async () => {
      if ((await this.db.rounds.where('courseId').equals(id).count()) > 0) {
        throw new StoreError('Course has recorded rounds; delete them first');
      }
      await this.db.courses.delete(id);
    });
  }

  private async withCourses(limit?: number) {
    const [courses, rounds] = await Promise.all([
      this.db.courses.toArray(),
      this.db.rounds.toArray(),
    ]);
    const byId = new Map(courses.map((c) => [c.id, c]));
    return rounds
      .sort(newestFirst)
      .slice(0, limit)
      .flatMap((round) => {
        const course = byId.get(round.courseId);
        return course ? [{ round, course }] : [];
      });
  }

  async listRounds(): Promise<RoundSummary[]> {
    return (await this.withCourses()).map((rc) => {
      const { holeSg: _holeSg, ...summary } = summarizeRound(rc);
      return summary;
    });
  }

  async getRound(id: string): Promise<RoundDetail> {
    const round = await this.db.rounds.get(id);
    if (!round) throw new StoreError('Round not found');
    const course = await this.getCourse(round.courseId);
    const { holeSg, ...summary } = summarizeRound({ round, course });
    return { round, course, summary, holes: holeSg };
  }

  async saveRound(input: RoundInput, id?: string): Promise<RoundDetail> {
    const data = parse(roundInputSchema, input);
    const course = await this.getCourse(data.courseId);
    const issues = roundIssues(data.holes, course);
    if (issues.length > 0) throw new StoreError('Scorecard has errors', issues);

    const existing = id === undefined ? undefined : await this.db.rounds.get(id);
    if (id !== undefined && !existing) throw new StoreError('Round not found');
    const round: Round = {
      id: existing?.id ?? crypto.randomUUID(),
      ...data,
      createdAt: existing?.createdAt ?? now(),
      updatedAt: now(),
    };
    await this.db.rounds.put(round);
    return this.getRound(round.id);
  }

  async deleteRound(id: string): Promise<void> {
    await this.db.rounds.delete(id);
  }

  async getStats(limit?: number): Promise<Stats> {
    return computeStats(await this.withCourses(limit));
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

  /** Replaces all local data with the backup after validating it end to end. */
  async importBackup(data: unknown): Promise<{ courses: number; rounds: number }> {
    const backup = parse(backupSchema, data);
    const courses = new Map(backup.courses.map((c) => [c.id, c]));
    for (const round of backup.rounds) {
      const course = courses.get(round.courseId);
      if (!course) throw new StoreError(`Round ${round.playedOn} references a missing course`);
      const issues = roundIssues(round.holes, course);
      if (issues.length > 0) throw new StoreError(`Round ${round.playedOn} is invalid`, issues);
    }
    await this.db.transaction('rw', this.db.courses, this.db.rounds, async () => {
      await Promise.all([this.db.courses.clear(), this.db.rounds.clear()]);
      await this.db.courses.bulkPut(backup.courses);
      await this.db.rounds.bulkPut(backup.rounds);
    });
    return { courses: backup.courses.length, rounds: backup.rounds.length };
  }
}
