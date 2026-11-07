import type { Course, Round } from '@golf-sg/shared';
import { Dexie, type EntityTable } from 'dexie';

/** On-device IndexedDB database; the source of truth for the offline-first web app. */
export class GolfDb extends Dexie {
  courses!: EntityTable<Course, 'id'>;
  rounds!: EntityTable<Round, 'id'>;

  constructor(name = 'golf-sg') {
    super(name);
    this.version(1).stores({
      courses: 'id, name',
      rounds: 'id, courseId, playedOn',
    });
  }
}
