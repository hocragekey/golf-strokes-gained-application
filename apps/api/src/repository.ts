import type { Course, HoleEntry, Round, ValidCourseInput, ValidRoundInput } from '@golf-sg/shared';
import { asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from './db/client.js';
import { courses, holeEntries, rounds, type CourseRow, type HoleEntryRow } from './db/schema.js';

const toCourse = (row: CourseRow): Course => ({ ...row });

const toEntry = ({ roundId: _roundId, ...entry }: HoleEntryRow): HoleEntry => entry;

export interface RoundFilter {
  courseId?: string | undefined;
  limit?: number | undefined;
}

export class Repository {
  constructor(private readonly db: Db) {}

  listCourses(): Course[] {
    return this.db.select().from(courses).orderBy(asc(courses.name)).all().map(toCourse);
  }

  getCourse(id: string): Course | undefined {
    const row = this.db.select().from(courses).where(eq(courses.id, id)).get();
    return row && toCourse(row);
  }

  createCourse(input: ValidCourseInput): Course {
    return toCourse(this.db.insert(courses).values(input).returning().get());
  }

  updateCourse(id: string, input: ValidCourseInput): Course | undefined {
    const [row] = this.db
      .update(courses)
      .set({ ...input, updatedAt: new Date().toISOString() })
      .where(eq(courses.id, id))
      .returning()
      .all();
    return row ? toCourse(row) : undefined;
  }

  deleteCourse(id: string): boolean {
    return this.db.delete(courses).where(eq(courses.id, id)).run().changes > 0;
  }

  countRoundsForCourse(courseId: string): number {
    const row = this.db
      .select({ n: sql<number>`count(*)` })
      .from(rounds)
      .where(eq(rounds.courseId, courseId))
      .get();
    return row?.n ?? 0;
  }

  maxHolePlayed(courseId: string): number {
    const row = this.db
      .select({ n: sql<number | null>`max(${holeEntries.holeNumber})` })
      .from(holeEntries)
      .innerJoin(rounds, eq(rounds.id, holeEntries.roundId))
      .where(eq(rounds.courseId, courseId))
      .get();
    return row?.n ?? 0;
  }

  listRounds(filter: RoundFilter = {}): Round[] {
    const query = this.db
      .select()
      .from(rounds)
      .where(filter.courseId === undefined ? undefined : eq(rounds.courseId, filter.courseId))
      .orderBy(desc(rounds.playedOn), desc(rounds.createdAt))
      .$dynamic();
    const rows = (filter.limit === undefined ? query : query.limit(filter.limit)).all();
    if (rows.length === 0) return [];

    const entries = this.db
      .select()
      .from(holeEntries)
      .where(
        inArray(
          holeEntries.roundId,
          rows.map((r) => r.id),
        ),
      )
      .orderBy(asc(holeEntries.roundId), asc(holeEntries.holeNumber))
      .all();
    const byRound = Map.groupBy(entries, (e) => e.roundId);
    return rows.map((r) => ({ ...r, holes: (byRound.get(r.id) ?? []).map(toEntry) }));
  }

  getRound(id: string): Round | undefined {
    const row = this.db.select().from(rounds).where(eq(rounds.id, id)).get();
    if (!row) return undefined;
    const entries = this.db
      .select()
      .from(holeEntries)
      .where(eq(holeEntries.roundId, id))
      .orderBy(asc(holeEntries.holeNumber))
      .all();
    return { ...row, holes: entries.map(toEntry) };
  }

  createRound(input: ValidRoundInput): Round {
    const id = this.db.transaction((tx) => {
      const { holes, ...round } = input;
      const created = tx.insert(rounds).values(round).returning({ id: rounds.id }).get();
      tx.insert(holeEntries)
        .values(holes.map((h) => ({ ...h, roundId: created.id })))
        .run();
      return created.id;
    });
    const round = this.getRound(id);
    if (!round) throw new Error(`Round ${id} missing after insert`);
    return round;
  }

  updateRound(id: string, input: ValidRoundInput): Round | undefined {
    const updated = this.db.transaction((tx) => {
      const { holes, ...round } = input;
      const changes = tx
        .update(rounds)
        .set({ ...round, updatedAt: new Date().toISOString() })
        .where(eq(rounds.id, id))
        .run().changes;
      if (changes === 0) return false;
      tx.delete(holeEntries).where(eq(holeEntries.roundId, id)).run();
      tx.insert(holeEntries)
        .values(holes.map((h) => ({ ...h, roundId: id })))
        .run();
      return true;
    });
    return updated ? this.getRound(id) : undefined;
  }

  deleteRound(id: string): boolean {
    return this.db.delete(rounds).where(eq(rounds.id, id)).run().changes > 0;
  }

  ping(): boolean {
    return this.db.get(sql`SELECT 1 AS ok`) !== undefined;
  }
}
