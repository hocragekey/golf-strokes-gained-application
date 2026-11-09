import type { Course, Round } from '@golf-sg/shared';
import { Dexie, type EntityTable } from 'dexie';
import { roundFromV1, type RoundV1 } from './legacy';

/** On-device IndexedDB database; the source of truth for the offline-first web app. */
export class GolfDb extends Dexie {
  /** Saved course layouts, used only to pre-fill par and yardage for a new round. */
  courses!: EntityTable<Course, 'id'>;
  rounds!: EntityTable<Round, 'id'>;

  constructor(name = 'golf-sg') {
    super(name);
    this.version(1).stores({
      courses: 'id, name',
      rounds: 'id, courseId, playedOn',
    });
    // v2: rounds own their hole layout (par/yardage) instead of referencing a course.
    this.version(2)
      .stores({ courses: 'id, name', rounds: 'id, playedOn' })
      .upgrade(async (tx) => {
        const courses = new Map(
          (await tx.table<Course>('courses').toArray()).map((c) => [c.id, c]),
        );
        await tx
          .table('rounds')
          .toCollection()
          .modify((round: RoundV1 | Round, ref: { value: RoundV1 | Round }) => {
            if ('courseId' in round) ref.value = roundFromV1(round, courses.get(round.courseId));
          });
      });
  }
}
