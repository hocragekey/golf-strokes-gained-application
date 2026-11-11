import { holeEntrySchema, parseCardMarks, type CardScanResult } from '@golf-sg/shared';
import {
  draftFromEntry,
  emptyDraft,
  emptyLayout,
  isBlank,
  type HoleDraft,
} from '../components/scorecard';
import type { RoundInProgress } from '../data/inProgress';

export const emptyRound = (playedOn: string): RoundInProgress => ({
  courseName: '',
  tees: '',
  playedOn,
  notes: '',
  holeCount: 18,
  layout: Array.from({ length: 18 }, emptyLayout),
  drafts: Array.from({ length: 18 }, emptyDraft),
});

/** The hole's marks as answers. Marks the parser can't use keep the score for review to fix. */
function draftFromScan(
  hole: CardScanResult['holes'][number],
  par: number,
): { draft: HoleDraft; ok: boolean } | null {
  if (hole.score === null) return null;
  const parsed =
    hole.putts === null
      ? null
      : parseCardMarks(
          { score: hole.score, drive: hole.drive, putts: hole.putts, stats: hole.stats },
          par,
        );
  const entry = parsed?.ok
    ? holeEntrySchema.safeParse({ holeNumber: hole.number, ...parsed.fields })
    : undefined;
  if (entry?.success) return { draft: draftFromEntry(entry.data), ok: true };
  return {
    draft: {
      ...emptyDraft(),
      score: String(hole.score),
      putts: hole.putts === null ? '' : String(hole.putts),
    },
    ok: false,
  };
}

/**
 * Fills a round from a scorecard photo (FR-CARD-06). Holes already entered are never overwritten.
 * `check` lists the holes to review: the reader was unsure, or a mark didn't make sense.
 */
export function applyScan(
  current: RoundInProgress,
  scan: CardScanResult,
): { round: RoundInProgress; check: number[] } {
  const layout = [...current.layout];
  const drafts = [...current.drafts];
  const check: number[] = [];
  for (const hole of scan.holes) {
    const i = hole.number - 1;
    if ((layout[i] ?? emptyLayout()).yardage === '' && hole.par !== null && hole.yardage !== null) {
      layout[i] = { par: String(hole.par), yardage: String(hole.yardage) };
    }
    if (!isBlank(drafts[i] ?? emptyDraft())) continue;
    const read = draftFromScan(hole, Number(layout[i]?.par) || 4);
    if (!read) continue;
    drafts[i] = read.draft;
    if (hole.unsure || !read.ok) check.push(hole.number);
  }
  const lastHole = Math.max(0, ...scan.holes.map((h) => h.number));
  return {
    round: {
      ...current,
      courseName: current.courseName || scan.courseName,
      tees: current.tees || scan.tees,
      holeCount: lastHole > 9 ? 18 : current.holeCount,
      layout,
      drafts,
      check: [...new Set([...(current.check ?? []), ...check])].sort((a, b) => a - b),
    },
    check,
  };
}
