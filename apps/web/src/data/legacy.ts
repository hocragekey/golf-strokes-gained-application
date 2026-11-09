import { courseSchema, holeEntrySchema, type Course, type Round } from '@golf-sg/shared';
import { z } from 'zod';

/** Rounds as stored before v2, when par and yardage lived only on a referenced course. */
export const roundV1Schema = z.object({
  id: z.uuid(),
  courseId: z.uuid(),
  playedOn: z.iso.date(),
  notes: z.string(),
  holes: z.array(holeEntrySchema).min(1).max(18),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type RoundV1 = z.infer<typeof roundV1Schema>;

export const backupV1Schema = z.object({
  app: z.literal('golf-strokes-gained'),
  version: z.literal(1),
  exportedAt: z.iso.datetime(),
  courses: z.array(courseSchema),
  rounds: z.array(roundV1Schema),
});

/** Copies the course's name, tees and par/yardage into the round so it stands alone. */
export function roundFromV1({ courseId: _courseId, ...round }: RoundV1, course?: Course): Round {
  return {
    ...round,
    courseName: course?.name ?? '',
    tees: course?.tees ?? '',
    layout: course?.holes.slice(0, round.holes.length) ?? [],
  };
}
