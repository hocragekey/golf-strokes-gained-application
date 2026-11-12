import { DEFAULT_BASELINE, type Baseline, type BaselineLie } from './baseline.js';
import type {
  CourseHole,
  HoleEntry,
  HoleSg,
  SgCategories,
  ShortGameLie,
  TeeResult,
} from './schemas.js';
import { strokesBeforeApproach } from './validation.js';

interface Position {
  distance: number;
  lie: BaselineLie;
}

const HOLED: Position = { distance: 0, lie: 'green' };

const driveLie = (result: TeeResult | null): BaselineLie =>
  result === 'left' || result === 'right' ? 'rough' : 'fairway';

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
 * The hole is split at the positions the golfer records: tee -> where the drive finished ->
 * approach -> first short-game shot -> first putt -> holed. Off the tee covers the tee shot(s)
 * (two after a re-tee); lay-ups and recoveries between the drive and the approach count toward
 * approach, as in standard strokes gained. Without the drive position (older rounds) every shot
 * before the approach counts toward off the tee. Penalties count toward off the tee when the tee
 * result is `penalty` or `ob`, otherwise toward approach. Categories sum to E(tee) - score.
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
  const teeShots = isPar3 ? 0 : Math.min(before, entry.teeResult === 'ob' ? 2 : 1);
  const layUps = before - teeShots;
  const afterDrive: Position | null =
    // Rounds saved before the field existed have no value at all, not null.
    !isPar3 && layUps > 0 && typeof entry.driveYardsLeft === 'number'
      ? { distance: entry.driveYardsLeft, lie: driveLie(entry.teeResult) }
      : null;
  const teePenalty =
    !isPar3 && (entry.teeResult === 'penalty' || entry.teeResult === 'ob') ? entry.penalties : 0;
  const approachPenalty = entry.penalties - teePenalty;

  const offTheTee = isPar3
    ? 0
    : afterDrive
      ? E(tee) - E(afterDrive) - teeShots - teePenalty
      : E(tee) - E(approach) - before - teePenalty;
  const layUpSg = afterDrive ? E(afterDrive) - E(approach) - layUps : 0;
  const approachSg =
    E(approach) - E(afterApproach) - 1 - approachPenalty - (isPar3 ? before : 0) + layUpSg;
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
