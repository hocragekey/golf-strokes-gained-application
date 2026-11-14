import { z } from 'zod';

/** Image types the scorecard reader accepts. */
export const CARD_SCAN_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type CardScanMediaType = (typeof CARD_SCAN_MEDIA_TYPES)[number];

/** Largest photo the reader accepts (the vision model's per-image limit). */
export const MAX_CARD_IMAGE_BYTES = 3_750_000;

/**
 * `layout`: a blank card before tee-off, read for par and every tee row's yardages.
 * `marks`: a card marked the two-row way after the round.
 * `card`: either; the layout plus any marks, so one photo button serves both.
 */
export const CARD_SCAN_KINDS = ['layout', 'marks', 'card'] as const;
export type CardScanKind = (typeof CARD_SCAN_KINDS)[number];

/** Photo reads allowed per Google account, and in total across everyone (FR-CARD-08). */
export const CARD_SCAN_LIMITS = { perUserPerDay: 6, perUserPerMonth: 40, allUsersPerDay: 500 };

export const cardScanRequestSchema = z.object({
  kind: z.enum(CARD_SCAN_KINDS).default('marks'),
  mediaType: z.enum(CARD_SCAN_MEDIA_TYPES),
  image: z.base64().max(Math.ceil(MAX_CARD_IMAGE_BYTES / 3) * 4),
});
export type CardScanRequest = z.input<typeof cardScanRequestSchema>;

const nullableInt = (min: number, max: number) => z.number().int().min(min).max(max).nullable();

/**
 * One hole as read from a photo of a scorecard marked the two-row way (FR-CARD-01): the printed
 * par and yardage plus the golfer's marks, left as written so the shared parser interprets them.
 */
export const scannedHoleSchema = z.object({
  number: z.number().int().min(1).max(18),
  par: nullableInt(3, 6),
  yardage: nullableInt(50, 800),
  score: nullableInt(1, 20),
  /** Drive mark as letters: F, L, R, S, X (drop) or XX (re-tee); null on par 3s or when unmarked. */
  drive: z.string().max(3).nullable(),
  putts: nullableInt(0, 10),
  /** Spare-row text, e.g. `175 / s15 / 8`. */
  stats: z.string().max(40),
  /** The reader could not make out at least one mark on this hole. */
  unsure: z.boolean(),
});
export type ScannedHole = z.infer<typeof scannedHoleSchema>;

export const cardScanResultSchema = z.object({
  courseName: z.string().max(100),
  tees: z.string().max(40),
  /** At least one hole: an empty read means the card couldn't be read. */
  holes: z.array(scannedHoleSchema).min(1).max(18),
});
export type CardScanResult = z.infer<typeof cardScanResultSchema>;

const yardages = z.array(nullableInt(50, 800)).max(18);

/** A blank scorecard: the printed par of each hole and every tee row's yardages (FR-CARD-07). */
export const cardLayoutResultSchema = z.object({
  courseName: z.string().max(100),
  /** Par per hole, hole 1 first; null where unreadable. */
  pars: z.array(nullableInt(3, 6)).min(1).max(18),
  tees: z.array(z.object({ name: z.string().min(1).max(40), yardages })).max(8),
});
export type CardLayoutResult = z.infer<typeof cardLayoutResultSchema>;

/** A card that may be blank or marked: the printed layout plus every hole the golfer scored. */
export const cardReadResultSchema = cardLayoutResultSchema.extend({
  /** Empty for a blank card. */
  holes: z.array(scannedHoleSchema).max(18),
});
export type CardReadResult = z.infer<typeof cardReadResultSchema>;
