import { z } from 'zod';

export const TEE_RESULTS = ['fairway', 'left', 'right', 'short', 'penalty'] as const;
export const APPROACH_LIES = ['tee', 'fairway', 'rough', 'sand', 'recovery'] as const;
export const SHORT_GAME_LIES = ['fringe', 'fairway', 'rough', 'sand'] as const;
export const MISS_DIRECTIONS = ['left', 'right', 'long', 'short'] as const;

export type TeeResult = (typeof TEE_RESULTS)[number];
export type ApproachLie = (typeof APPROACH_LIES)[number];
export type ShortGameLie = (typeof SHORT_GAME_LIES)[number];
export type MissDirection = (typeof MISS_DIRECTIONS)[number];

const id = z.uuid();
const isoDate = z.iso.date();
const timestamp = z.iso.datetime();

export const courseHoleSchema = z.object({
  number: z.number().int().min(1).max(18),
  par: z.number().int().min(3).max(6),
  yardage: z.number().int().min(50).max(800),
});
export type CourseHole = z.infer<typeof courseHoleSchema>;

export const courseInputSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(100),
    tees: z.string().trim().max(40).default(''),
    // Saved courses are pre-fill shortcuts, so a partial layout from a short round is fine.
    holes: z.array(courseHoleSchema).min(1, 'A course needs at least one hole').max(18),
  })
  .refine((c) => c.holes.every((h, i) => h.number === i + 1), {
    message: 'Holes must be numbered consecutively from 1',
    path: ['holes'],
  });
export type CourseInput = z.input<typeof courseInputSchema>;
export type ValidCourseInput = z.output<typeof courseInputSchema>;

export const courseSchema = z.object({
  id,
  name: z.string(),
  tees: z.string(),
  holes: z.array(courseHoleSchema),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type Course = z.infer<typeof courseSchema>;

const nullableInt = (min: number, max: number) => z.number().int().min(min).max(max).nullable();

/**
 * What the golfer marks on the card for one hole. Distances to the hole are in yards off the
 * green and feet on the green. `null` means "not applicable / not recorded".
 */
export const holeEntrySchema = z.object({
  holeNumber: z.number().int().min(1).max(18),
  score: z.number().int().min(1).max(20),
  teeResult: z.enum(TEE_RESULTS).nullable().default(null),
  approachYards: nullableInt(1, 700).default(null),
  approachLie: z.enum(APPROACH_LIES).default('fairway'),
  gir: z.boolean(),
  missDirection: z.enum(MISS_DIRECTIONS).nullable().default(null),
  shortGameShots: z.number().int().min(0).max(10).default(0),
  shortGameYards: nullableInt(1, 60).default(null),
  shortGameLie: z.enum(SHORT_GAME_LIES).nullable().default(null),
  firstPuttFeet: nullableInt(1, 150).default(null),
  putts: z.number().int().min(0).max(10),
  penalties: z.number().int().min(0).max(10).default(0),
});
export type HoleEntryInput = z.input<typeof holeEntrySchema>;
export type HoleEntry = z.output<typeof holeEntrySchema>;

/**
 * A round carries the par and yardage of every hole it played (copied from the scorecard), so
 * it never depends on a saved course. `courseName` is optional and only used for display and
 * to pre-fill the next round at the same course.
 */
export const roundInputSchema = z
  .object({
    courseName: z.string().trim().max(100).default(''),
    tees: z.string().trim().max(40).default(''),
    playedOn: isoDate,
    notes: z.string().trim().max(1000).default(''),
    layout: z.array(courseHoleSchema).min(1).max(18),
    holes: z.array(holeEntrySchema).min(1).max(18),
  })
  .refine((r) => r.holes.every((h, i) => h.holeNumber === i + 1), {
    message: 'Holes must be numbered consecutively from 1',
    path: ['holes'],
  })
  .refine(
    (r) => r.layout.length === r.holes.length && r.layout.every((h, i) => h.number === i + 1),
    { message: 'Every played hole needs a par and yardage', path: ['layout'] },
  );
export type RoundInput = z.input<typeof roundInputSchema>;
export type ValidRoundInput = z.output<typeof roundInputSchema>;

export const roundSchema = z.object({
  id,
  courseName: z.string(),
  tees: z.string(),
  playedOn: isoDate,
  notes: z.string(),
  layout: z.array(courseHoleSchema).min(1).max(18),
  holes: z.array(holeEntrySchema).min(1).max(18),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type Round = z.infer<typeof roundSchema>;

export const sgCategoriesSchema = z.object({
  offTheTee: z.number(),
  approach: z.number(),
  aroundTheGreen: z.number(),
  putting: z.number(),
  total: z.number(),
});
export type SgCategories = z.infer<typeof sgCategoriesSchema>;

export const holeSgSchema = sgCategoriesSchema.extend({
  holeNumber: z.number().int(),
  par: z.number().int(),
  score: z.number().int(),
});
export type HoleSg = z.infer<typeof holeSgSchema>;

export const roundSummarySchema = z.object({
  id,
  courseName: z.string(),
  playedOn: isoDate,
  holesPlayed: z.number().int(),
  score: z.number().int(),
  toPar: z.number().int(),
  sg: sgCategoriesSchema,
});
export type RoundSummary = z.infer<typeof roundSummarySchema>;

export const roundDetailSchema = z.object({
  round: roundSchema,
  summary: roundSummarySchema,
  holes: z.array(holeSgSchema),
});
export type RoundDetail = z.infer<typeof roundDetailSchema>;

export const bucketStatSchema = z.object({
  label: z.string(),
  count: z.number().int(),
  sgTotal: z.number(),
  sgPerShot: z.number(),
});
export type BucketStat = z.infer<typeof bucketStatSchema>;

export const categoryKeySchema = z.enum(['offTheTee', 'approach', 'aroundTheGreen', 'putting']);
export type CategoryKey = z.infer<typeof categoryKeySchema>;

export const practicePrioritySchema = z.object({
  category: categoryKeySchema,
  sgPer18: z.number(),
  focus: z.string(),
});
export type PracticePriority = z.infer<typeof practicePrioritySchema>;

export const statsSchema = z.object({
  baseline: z.string(),
  rounds: z.number().int(),
  holes: z.number().int(),
  sgPer18: sgCategoriesSchema,
  traditional: z.object({
    scoringAverage: z.number().nullable(),
    fairwayPct: z.number().nullable(),
    missLeftPct: z.number().nullable(),
    missRightPct: z.number().nullable(),
    girPct: z.number().nullable(),
    puttsPer18: z.number().nullable(),
    upAndDownPct: z.number().nullable(),
  }),
  approachByDistance: z.array(bucketStatSchema),
  approachMisses: z.record(z.enum(MISS_DIRECTIONS), z.number().int()),
  aroundTheGreenByLie: z.array(bucketStatSchema),
  puttingByDistance: z.array(bucketStatSchema),
  priorities: z.array(practicePrioritySchema),
  trend: z.array(roundSummarySchema),
});
export type Stats = z.infer<typeof statsSchema>;

export const apiErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
  issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
