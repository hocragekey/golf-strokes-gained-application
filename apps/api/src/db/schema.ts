import type { CourseHole } from '@golf-sg/shared';
import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

const timestamps = {
  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
};

export const courses = sqliteTable('courses', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  tees: text('tees').notNull().default(''),
  holes: text('holes', { mode: 'json' }).$type<CourseHole[]>().notNull(),
  ...timestamps,
});

export const rounds = sqliteTable(
  'rounds',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    courseId: text('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'restrict' }),
    playedOn: text('played_on').notNull(),
    notes: text('notes').notNull().default(''),
    ...timestamps,
  },
  (t) => [index('rounds_played_on_idx').on(t.playedOn), index('rounds_course_idx').on(t.courseId)],
);

export const holeEntries = sqliteTable(
  'hole_entries',
  {
    roundId: text('round_id')
      .notNull()
      .references(() => rounds.id, { onDelete: 'cascade' }),
    holeNumber: integer('hole_number').notNull(),
    score: integer('score').notNull(),
    teeResult: text('tee_result', {
      enum: ['fairway', 'left', 'right', 'short', 'penalty'],
    }),
    approachYards: integer('approach_yards'),
    approachLie: text('approach_lie', {
      enum: ['tee', 'fairway', 'rough', 'sand', 'recovery'],
    }).notNull(),
    gir: integer('gir', { mode: 'boolean' }).notNull(),
    missDirection: text('miss_direction', { enum: ['left', 'right', 'long', 'short'] }),
    shortGameShots: integer('short_game_shots').notNull(),
    shortGameYards: integer('short_game_yards'),
    shortGameLie: text('short_game_lie', { enum: ['fringe', 'fairway', 'rough', 'sand'] }),
    firstPuttFeet: integer('first_putt_feet'),
    putts: integer('putts').notNull(),
    penalties: integer('penalties').notNull(),
  },
  (t) => [primaryKey({ columns: [t.roundId, t.holeNumber] })],
);

export type CourseRow = typeof courses.$inferSelect;
export type RoundRow = typeof rounds.$inferSelect;
export type HoleEntryRow = typeof holeEntries.$inferSelect;
