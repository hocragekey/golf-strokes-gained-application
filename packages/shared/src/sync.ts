import { z } from 'zod';
import { courseSchema, roundSchema, type Course, type Round } from './schemas.js';
import { roundIssues } from './validation.js';

/** Most changes accepted in one push; clients send larger outboxes in batches. */
export const MAX_PUSH_CHANGES = 100;
/** Pulls re-read this much history before the cursor to absorb clock skew between writers. */
export const PULL_OVERLAP_MS = 5000;

export const SYNC_KINDS = ['round', 'course'] as const;
export type SyncKind = (typeof SYNC_KINDS)[number];

const timestamp = z.iso.datetime();

/** One entity's latest state. A change with `deletedAt` is a tombstone and carries no data. */
export const changeSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('round'),
    id: z.uuid(),
    updatedAt: timestamp,
    deletedAt: timestamp.nullable(),
    data: roundSchema.optional(),
  }),
  z.object({
    kind: z.literal('course'),
    id: z.uuid(),
    updatedAt: timestamp,
    deletedAt: timestamp.nullable(),
    data: courseSchema.optional(),
  }),
]);
export type Change = z.infer<typeof changeSchema>;

export const pushRequestSchema = z.object({
  changes: z.array(changeSchema).max(MAX_PUSH_CHANGES),
});
export type PushRequest = z.infer<typeof pushRequestSchema>;

export const pushResponseSchema = z.object({
  /** Stored on the server. */
  applied: z.array(z.string()),
  /** The server already had a newer version; it comes back on the next pull. */
  stale: z.array(z.string()),
  rejected: z.array(z.object({ id: z.string(), reason: z.string() })),
});
export type PushResponse = z.infer<typeof pushResponseSchema>;

export const pullResponseSchema = z.object({
  changes: z.array(changeSchema),
  /** Opaque; pass back as `since` on the next pull. */
  cursor: z.string(),
  /** More changes are waiting: pull again straight away with the new cursor. */
  more: z.boolean(),
});
export type PullResponse = z.infer<typeof pullResponseSchema>;

export const changeKey = (kind: SyncKind, id: string): string => `${kind}:${id}`;

/** Last writer wins: true when `incoming` should replace `current`. Ties keep the current copy. */
export const isNewer = (incoming: string, current: string | undefined): boolean =>
  current === undefined || Date.parse(incoming) > Date.parse(current);

/** Problems that make a stored round unusable (numbering, missing layout, scorecard errors). */
export function storedRoundProblem(round: Round): string | null {
  if (round.layout.length !== round.holes.length) return 'Every hole needs a par and yardage';
  const numbered =
    round.holes.every((h, i) => h.holeNumber === i + 1) &&
    round.layout.every((h, i) => h.number === i + 1);
  if (!numbered) return 'Holes must be numbered consecutively from 1';
  const issues = roundIssues(round.holes, round.layout);
  return issues[0] ? `${issues[0].path}: ${issues[0].message}` : null;
}

/** Why a change cannot be stored, or null when it is acceptable. */
export function changeProblem(change: Change): string | null {
  if (change.deletedAt !== null) return change.data ? 'A tombstone carries no data' : null;
  if (!change.data) return 'Missing data';
  if (change.data.id !== change.id) return 'Data id does not match the change id';
  if (change.data.updatedAt !== change.updatedAt) return 'Data updatedAt does not match the change';
  return change.kind === 'round' ? storedRoundProblem(change.data) : null;
}

export const roundChange = (round: Round): Change => ({
  kind: 'round',
  id: round.id,
  updatedAt: round.updatedAt,
  deletedAt: null,
  data: round,
});

export const courseChange = (course: Course): Change => ({
  kind: 'course',
  id: course.id,
  updatedAt: course.updatedAt,
  deletedAt: null,
  data: course,
});

export const tombstone = (kind: SyncKind, id: string, deletedAt: string): Change => ({
  kind,
  id,
  updatedAt: deletedAt,
  deletedAt,
});
