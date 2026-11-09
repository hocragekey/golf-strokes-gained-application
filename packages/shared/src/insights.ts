import { DEFAULT_BASELINE, type Baseline } from './baseline.js';
import type {
  BucketStat,
  CategoryKey,
  HoleSg,
  MissDirection,
  PracticePriority,
  Round,
  RoundSummary,
  SgCategories,
  Stats,
} from './schemas.js';
import { emptyCategories, round2, roundStrokesGained, sumCategories } from './strokes-gained.js';

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  offTheTee: 'Off the tee',
  approach: 'Approach',
  aroundTheGreen: 'Around the green',
  putting: 'Putting',
};

export const APPROACH_BANDS = [
  { label: '<100 yds', max: 100 },
  { label: '100–150 yds', max: 150 },
  { label: '150–200 yds', max: 200 },
  { label: '200+ yds', max: Infinity },
] as const;

export const PUTT_BANDS = [
  { label: '0–5 ft', max: 5 },
  { label: '6–10 ft', max: 10 },
  { label: '11–20 ft', max: 20 },
  { label: '21–40 ft', max: 40 },
  { label: '40+ ft', max: Infinity },
] as const;

const MIN_SAMPLE = 3;

const pct = (n: number, d: number): number | null => (d === 0 ? null : round2((n / d) * 100));

export function summarizeRound(
  round: Round,
  baseline: Baseline = DEFAULT_BASELINE,
): RoundSummary & { holeSg: HoleSg[] } {
  const { holes, total } = roundStrokesGained(round.layout, round.holes, baseline);
  const score = round.holes.reduce((a, h) => a + h.score, 0);
  const par = holes.reduce((a, h) => a + h.par, 0);
  return {
    id: round.id,
    courseName: round.courseName,
    playedOn: round.playedOn,
    holesPlayed: round.holes.length,
    score,
    toPar: score - par,
    sg: total,
    holeSg: holes,
  };
}

class Bucket {
  count = 0;
  sgTotal = 0;
  constructor(readonly label: string) {}
  add(sg: number): void {
    this.count++;
    this.sgTotal += sg;
  }
  toStat(): BucketStat {
    return {
      label: this.label,
      count: this.count,
      sgTotal: round2(this.sgTotal),
      sgPerShot: this.count === 0 ? 0 : round2(this.sgTotal / this.count),
    };
  }
}

function bandFor<T extends { max: number }>(bands: readonly T[], value: number): T {
  const last = bands.at(-1);
  if (!last) throw new Error('bands must not be empty');
  return bands.find((b) => value <= b.max) ?? last;
}

const chronological = (a: Round, b: Round): number =>
  a.playedOn.localeCompare(b.playedOn) || a.createdAt.localeCompare(b.createdAt);

function worst(buckets: readonly BucketStat[]): BucketStat | undefined {
  return [...buckets]
    .filter((b) => b.count >= MIN_SAMPLE)
    .sort((a, b) => a.sgPerShot - b.sgPerShot)[0];
}

/** Aggregates rounds into per-18-hole strokes gained, traditional stats and practice priorities. */
export function computeStats(
  rounds: readonly Round[],
  baseline: Baseline = DEFAULT_BASELINE,
): Stats {
  const ordered = [...rounds].sort(chronological);
  const summaries = ordered.map((r) => summarizeRound(r, baseline));
  const holeCount = summaries.reduce((a, s) => a + s.holesPlayed, 0);
  const per18 = (n: number) => (holeCount === 0 ? 0 : round2((n * 18) / holeCount));

  const approach = APPROACH_BANDS.map((b) => new Bucket(b.label));
  const putting = PUTT_BANDS.map((b) => new Bucket(b.label));
  const arg = new Map<string, Bucket>();
  const misses: Record<MissDirection, number> = { left: 0, right: 0, long: 0, short: 0 };
  let drives = 0;
  let fairways = 0;
  let missLeft = 0;
  let missRight = 0;
  let girs = 0;
  let putts = 0;
  let strokes = 0;
  let upAndDownChances = 0;
  let upAndDowns = 0;

  for (const [i, round] of ordered.entries()) {
    const holeSg = summaries[i]?.holeSg ?? [];
    round.holes.forEach((entry, j) => {
      const sg = holeSg[j];
      const hole = round.layout.find((h) => h.number === entry.holeNumber);
      if (!sg || !hole) return;
      strokes += entry.score;
      putts += entry.putts;
      if (entry.gir) girs++;
      if (hole.par > 3) {
        drives++;
        if (entry.teeResult === 'fairway') fairways++;
        if (entry.teeResult === 'left') missLeft++;
        if (entry.teeResult === 'right') missRight++;
      }
      const approachYards = hole.par === 3 ? hole.yardage : entry.approachYards;
      if (approachYards !== null) {
        approach[APPROACH_BANDS.indexOf(bandFor(APPROACH_BANDS, approachYards))]?.add(sg.approach);
      }
      if (entry.missDirection) misses[entry.missDirection]++;
      if (entry.shortGameShots > 0 && entry.shortGameLie) {
        const bucket = arg.get(entry.shortGameLie) ?? new Bucket(entry.shortGameLie);
        bucket.add(sg.aroundTheGreen);
        arg.set(entry.shortGameLie, bucket);
        if (!entry.gir) {
          upAndDownChances++;
          if (entry.shortGameShots + entry.putts <= 2) upAndDowns++;
        }
      }
      if (entry.putts > 0 && entry.firstPuttFeet !== null) {
        putting[PUTT_BANDS.indexOf(bandFor(PUTT_BANDS, entry.firstPuttFeet))]?.add(sg.putting);
      }
    });
  }

  const totals: SgCategories = sumCategories(summaries.map((s) => s.sg));
  const sgPer18: SgCategories =
    holeCount === 0
      ? emptyCategories()
      : {
          offTheTee: per18(totals.offTheTee),
          approach: per18(totals.approach),
          aroundTheGreen: per18(totals.aroundTheGreen),
          putting: per18(totals.putting),
          total: per18(totals.total),
        };

  const approachStats = approach.map((b) => b.toStat());
  const puttingStats = putting.map((b) => b.toStat());
  const argStats = [...arg.values()].map((b) => b.toStat());
  const fairwayPct = pct(fairways, drives);
  const leftPct = pct(missLeft, drives);
  const rightPct = pct(missRight, drives);

  const focus: Record<CategoryKey, string> = {
    offTheTee:
      fairwayPct === null
        ? 'Record tee results on par 4s and 5s'
        : `Fairways ${fairwayPct}% — misses ${(leftPct ?? 0) >= (rightPct ?? 0) ? 'left' : 'right'} ${Math.max(leftPct ?? 0, rightPct ?? 0)}%`,
    approach: describeWorst(worst(approachStats), 'Approaches from', 'per shot'),
    aroundTheGreen: describeWorst(worst(argStats), 'Short game from', 'per hole'),
    putting: describeWorst(worst(puttingStats), 'First putts from', 'per hole'),
  };

  const priorities: PracticePriority[] = (Object.keys(CATEGORY_LABELS) as CategoryKey[])
    .map((category) => ({ category, sgPer18: sgPer18[category], focus: focus[category] }))
    .sort((a, b) => a.sgPer18 - b.sgPer18);

  return {
    baseline: baseline.name,
    rounds: summaries.length,
    holes: holeCount,
    sgPer18,
    traditional: {
      scoringAverage: holeCount === 0 ? null : per18(strokes),
      fairwayPct,
      missLeftPct: leftPct,
      missRightPct: rightPct,
      girPct: pct(girs, holeCount),
      puttsPer18: holeCount === 0 ? null : per18(putts),
      upAndDownPct: pct(upAndDowns, upAndDownChances),
    },
    approachByDistance: approachStats,
    approachMisses: misses,
    aroundTheGreenByLie: argStats,
    puttingByDistance: puttingStats,
    priorities,
    trend: summaries.map(({ holeSg: _holeSg, ...summary }) => summary),
  };
}

function describeWorst(bucket: BucketStat | undefined, prefix: string, unit: string): string {
  if (!bucket) return `Not enough data yet (need ${MIN_SAMPLE}+ samples in a range)`;
  const sign = bucket.sgPerShot > 0 ? '+' : '';
  return `${prefix} ${bucket.label}: ${sign}${bucket.sgPerShot.toFixed(2)} ${unit} (${bucket.count} samples)`;
}
