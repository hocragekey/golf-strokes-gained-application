import { DEFAULT_BASELINE, type Baseline, type BaselineLie } from './baseline.js';
import type { CourseHole, HoleEntry, HoleSg, SgCategories, ShortGameLie } from './schemas.js';
import { strokesBeforeApproach } from './validation.js';

interface Position {
  distance: number;
  lie: BaselineLie;
}

const HOLED: Position = { distance: 0, lie: 'green' };

const shortGameLie = (lie: ShortGameLie | null): BaselineLie =>
  lie === 'sand' ? 'sand' : lie === 'rough' ? 'rough' : 'fairway';

export const round2 = (n: number): number => Math.round(n * 100) / 100;

export const emptyCategories = (): SgCategories => ({
  offTheTee: 0,
  approach: 0,
  aroundTheGreen: 0,
  putting: 0,
  total: 0,
});

/**
 * Strokes gained for one hole: SG(shot) = E(start) - E(end) - strokes.
 *
 * The hole is split at the positions the golfer records: tee -> approach -> first short-game
 * shot -> first putt -> holed. Lay-ups and recoveries before the approach count toward
 * off-the-tee. Penalties count toward off-the-tee when the tee result is `penalty`, otherwise
 * toward approach. Category values always sum to E(tee) - score.
 */
export function holeStrokesGained(
  hole: CourseHole,
  entry: HoleEntry,
  baseline: Baseline = DEFAULT_BASELINE,
): HoleSg {
  const E = (p: Position) => baseline.expectedStrokes(p.distance, p.lie);
  const isPar3 = hole.par === 3;

  const tee: Position = { distance: hole.yardage, lie: 'tee' };
  const approach: Position = isPar3
    ? tee
    : { distance: entry.approachYards ?? hole.yardage, lie: entry.approachLie };
  const putt: Position =
    entry.putts > 0 && entry.firstPuttFeet !== null
      ? { distance: entry.firstPuttFeet, lie: 'green' }
      : HOLED;
  const shortGame: Position | null =
    entry.shortGameShots > 0 && entry.shortGameYards !== null
      ? { distance: entry.shortGameYards, lie: shortGameLie(entry.shortGameLie) }
      : null;
  const afterApproach = shortGame ?? putt;

  const before = Math.max(0, strokesBeforeApproach(entry));
  const teePenalty = entry.teeResult === 'penalty' && !isPar3 ? entry.penalties : 0;
  const approachPenalty = entry.penalties - teePenalty;

  const offTheTee = isPar3 ? 0 : E(tee) - E(approach) - before - teePenalty;
  const approachSg = E(approach) - E(afterApproach) - 1 - approachPenalty - (isPar3 ? before : 0);
  const aroundTheGreen = shortGame ? E(shortGame) - E(putt) - entry.shortGameShots : 0;
  const putting = entry.putts > 0 ? E(putt) - entry.putts : 0;

  return {
    holeNumber: entry.holeNumber,
    par: hole.par,
    score: entry.score,
    offTheTee: round2(offTheTee),
    approach: round2(approachSg),
    aroundTheGreen: round2(aroundTheGreen),
    putting: round2(putting),
    total: round2(E(tee) - entry.score),
  };
}

export function sumCategories(items: readonly SgCategories[]): SgCategories {
  const total = items.reduce((acc, s) => {
    acc.offTheTee += s.offTheTee;
    acc.approach += s.approach;
    acc.aroundTheGreen += s.aroundTheGreen;
    acc.putting += s.putting;
    acc.total += s.total;
    return acc;
  }, emptyCategories());
  return {
    offTheTee: round2(total.offTheTee),
    approach: round2(total.approach),
    aroundTheGreen: round2(total.aroundTheGreen),
    putting: round2(total.putting),
    total: round2(total.total),
  };
}

export function roundStrokesGained(
  holes: readonly CourseHole[],
  entries: readonly HoleEntry[],
  baseline: Baseline = DEFAULT_BASELINE,
): { holes: HoleSg[]; total: SgCategories } {
  const perHole = entries.map((entry) => {
    const hole = holes.find((h) => h.number === entry.holeNumber);
    if (!hole) throw new Error(`Course has no hole ${entry.holeNumber}`);
    return holeStrokesGained(hole, entry, baseline);
  });
  return { holes: perHole, total: sumCategories(perHole) };
}
