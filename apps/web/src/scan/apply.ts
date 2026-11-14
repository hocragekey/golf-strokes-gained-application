import {
  holeEntrySchema,
  parseCardMarks,
  type CardLayoutResult,
  type CardScanResult,
} from '@golf-sg/shared';
import {
  draftFromEntry,
  emptyDraft,
  emptyLayout,
  isBlank,
  type HoleDraft,
  type LayoutDraft,
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
    const current = layout[i] ?? emptyLayout();
    if (current.yardage === '' && hole.par !== null) {
      // The printed par is used even when the yardage couldn't be read; the marks depend on it.
      layout[i] = {
        par: String(hole.par),
        yardage: hole.yardage === null ? '' : String(hole.yardage),
      };
    }
    if (!isBlank(drafts[i] ?? emptyDraft())) continue;
    const read = draftFromScan(hole, Number(layout[i]?.par) || 4);
    if (!read) {
      // Listed but no score could be read: the golfer has to fill it in.
      check.push(hole.number);
      continue;
    }
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

/**
 * Fills each hole's par and the chosen tee row's yardage from a blank card (FR-CARD-07), keeping
 * whatever the card doesn't show.
 */
export function applyLayout(
  layout: LayoutDraft[],
  scan: CardLayoutResult,
  tee: number | null,
): { layout: LayoutDraft[]; holeCount: number } {
  const yards = tee === null ? [] : (scan.tees[tee]?.yardages ?? []);
  const holes = Math.max(scan.pars.length, yards.length);
  return {
    holeCount: holes > 9 ? 18 : 9,
    layout: layout.map((l, i) => {
      const par = scan.pars[i];
      const yardage = yards[i];
      return {
        par: par == null ? l.par : String(par),
        yardage: yardage == null ? l.yardage : String(yardage),
      };
    }),
  };
}
