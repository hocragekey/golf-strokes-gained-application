import type { HoleEntryInput, ShortGameLie, TeeResult } from './schemas.js';

/** Fields a hole's card marks can fill; the hole number and par come from the scorecard. */
export type NotationFields = Omit<HoleEntryInput, 'holeNumber'>;

export type NotationResult = { ok: true; fields: NotationFields } | { ok: false; error: string };

/** What the golfer writes for one hole on the two-row card (see the card guide). */
export interface CardMarks {
  score: number;
  /** Drive arrow or letter: ↑/F fairway, ←/L left, →/R right, ↓/S short, ✕/X drop, ✕✕/XX re-tee. */
  drive: string | null;
  putts: number;
  /**
   * Spare row: `[yards left after drive /] approach yards / chip / first-putt feet`, e.g.
   * `175 / s15 / 8` or, on a par 5, `250 / 110 / 25`.
   */
  stats: string;
}

const DRIVE: Record<string, TeeResult> = {
  f: 'fairway',
  '↑': 'fairway',
  l: 'left',
  '←': 'left',
  r: 'right',
  '→': 'right',
  s: 'short',
  '↓': 'short',
  x: 'penalty',
  '✕': 'penalty',
  p: 'penalty',
  xx: 'ob',
  '✕✕': 'ob',
};
const APPROACH_LIE = { f: 'fairway', r: 'rough', s: 'sand', t: 'recovery' } as const;
const CHIP_LIE: Record<string, ShortGameLie> = { f: 'fairway', r: 'rough', s: 'sand' };

/**
 * Turns one hole's card marks into hole fields. Green in regulation and the number of short-game
 * shots are worked out from the score and putts, assuming the approach was shot `par - 2`.
 */
export function parseCardMarks(marks: CardMarks, par: number): NotationResult {
  const fail = (error: string): NotationResult => ({ ok: false, error });
  const isPar3 = par === 3;
  const { score, putts } = marks;
  if (!Number.isInteger(score) || score < 1) return fail('Start with the score, e.g. "5"');
  if (!Number.isInteger(putts) || putts < 0) return fail('Add the number of putts');

  let teeResult: TeeResult | null = null;
  if (!isPar3) {
    const drive = DRIVE[(marks.drive ?? '').trim().toLowerCase()];
    if (!drive) return fail('Add the drive: F, L, R, S or X');
    teeResult = drive;
  } else if (marks.drive) {
    return fail('Par 3s have no drive mark');
  }

  const items = marks.stats
    .toLowerCase()
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);
  const unknown = (item: string) =>
    fail(`Didn't understand "${item}": use chip like "s15" and putt feet like "8"`);
  const isChip = (item: string | undefined) => item !== undefined && /^[frs]\d+$/.test(item);
  const isFeet = (item: string | undefined) => item !== undefined && /^\d+$/.test(item);

  let firstPuttFeet: number | null = null;
  if (putts > 0) {
    if (!isFeet(items.at(-1))) return fail('Add the first-putt feet at the end');
    firstPuttFeet = Number(items.pop());
  } else if (isFeet(items.at(-1)) && isChip(items.at(-2))) {
    return fail('No putts, so leave out the putt feet');
  }
  let chip: { lie: ShortGameLie; yards: number } | null = null;
  const c = /^([frs])(\d+)$/.exec(items.at(-1) ?? '');
  if (c) {
    chip = { lie: CHIP_LIE[c[1] ?? 'f'] ?? 'fairway', yards: Number(c[2]) };
    items.pop();
  }

  let approachYards: number | null = null;
  let approachLie: NotationFields['approachLie'] = isPar3 ? 'tee' : 'fairway';
  let driveYardsLeft: number | null = null;
  if (!isPar3) {
    const approachItem = items.pop();
    if (approachItem === undefined) {
      return fail('Add the approach yards and the first-putt feet, e.g. "150 / 25"');
    }
    const m = /^(\d+)([frst]?)$/.exec(approachItem);
    if (!m) return unknown(approachItem);
    approachYards = Number(m[1]);
    const lie = m[2] as keyof typeof APPROACH_LIE | '';
    approachLie = lie
      ? APPROACH_LIE[lie]
      : teeResult === 'left' || teeResult === 'right'
        ? 'rough'
        : 'fairway';
    const driveItem = items.pop();
    if (driveItem !== undefined) {
      if (!isFeet(driveItem)) return unknown(driveItem);
      driveYardsLeft = Number(driveItem);
    }
  }
  const extra = items[0];
  if (extra !== undefined) return unknown(extra);

  const penalties = teeResult === 'penalty' || teeResult === 'ob' ? 1 : 0;
  const retee = teeResult === 'ob' ? 1 : 0;
  const shortGameShots = chip ? Math.max(1, score - putts - penalties - retee - (par - 2)) : 0;
  return {
    ok: true,
    fields: {
      score,
      teeResult,
      driveYardsLeft,
      approachYards,
      approachLie,
      gir: !chip && score - Math.max(putts, 1) <= par - 2,
      missDirection: null,
      shortGameShots,
      shortGameYards: chip?.yards ?? null,
      shortGameLie: chip?.lie ?? null,
      firstPuttFeet,
      putts,
      penalties,
    },
  };
}

/**
 * Parses a hole typed on one line: score, drive (par 4/5), putts, then the spare-row numbers,
 * e.g. `5 R 1 175 / s15 / 8` or `3 2 20`.
 */
export function parseHoleNotation(line: string, par: number): NotationResult {
  // Plain token splitting (no backtracking regex) keeps parsing linear on any input.
  if (line.length > 120) return { ok: false, error: 'That line is too long for one hole' };
  // Slashes may be typed without spaces (`5 R 2/175/8`).
  const tokens = line.trim().replaceAll('/', ' / ').split(/\s+/);
  const isNumber = (t: string | undefined) => t !== undefined && /^\d{1,3}$/.test(t);
  let i = 0;
  const score = tokens[i++];
  const drive = isNumber(tokens[i]) ? null : (tokens[i++] ?? null);
  const putts = tokens[i++];
  if (!isNumber(score) || !isNumber(putts) || (drive !== null && drive.length > 2)) {
    return {
      ok: false,
      error:
        par === 3
          ? 'Type score, putts, then the numbers, e.g. "3 2 20"'
          : 'Type score, drive, putts, then the numbers, e.g. "5 R 1 175 / s15 / 8"',
    };
  }
  return parseCardMarks(
    { score: Number(score), drive, putts: Number(putts), stats: tokens.slice(i).join(' ') },
    par,
  );
}
