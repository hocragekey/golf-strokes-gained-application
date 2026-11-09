import type {
  ApproachLie,
  HoleEntryInput,
  MissDirection,
  ShortGameLie,
  TeeResult,
} from './schemas.js';

/** Fields a one-line card notation can fill; the hole number and par come from the scorecard. */
export type NotationFields = Omit<HoleEntryInput, 'holeNumber'>;

export type NotationResult = { ok: true; fields: NotationFields } | { ok: false; error: string };

const TEE: Record<string, TeeResult> = {
  f: 'fairway',
  l: 'left',
  r: 'right',
  s: 'short',
  p: 'penalty',
};
const APPROACH_LIE: Record<string, ApproachLie> = {
  '': 'fairway',
  r: 'rough',
  s: 'sand',
  t: 'recovery',
};
const SHORT_LIE: Record<string, ShortGameLie> = {
  '': 'fairway',
  f: 'fringe',
  r: 'rough',
  s: 'sand',
};
const MISS: Record<string, MissDirection> = { l: 'left', r: 'right', lg: 'long', sh: 'short' };
const GIR = new Set(['✓', '✔', 'v', 'g', 'gir']);

/**
 * Parses the card-guide notation for one hole, e.g. `5 R 165r Sh 1@15s 1@4` or `3 ✓ 2@25`:
 * score, tee (par 4/5), approach yards + lie (par 4/5), green, short game, putts, penalties.
 */
export function parseHoleNotation(line: string, par: number): NotationResult {
  const tokens = line.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const fail = (error: string): NotationResult => ({ ok: false, error });
  const isPar3 = par === 3;
  let i = 0;
  const next = () => tokens[i];

  const score = Number(next());
  if (!Number.isInteger(score) || score < 1) return fail('Start with the score, e.g. "5"');
  i++;

  const fields: NotationFields = {
    score,
    teeResult: null,
    approachYards: null,
    approachLie: isPar3 ? 'tee' : 'fairway',
    gir: false,
    missDirection: null,
    shortGameShots: 0,
    shortGameYards: null,
    shortGameLie: null,
    firstPuttFeet: null,
    putts: 0,
    penalties: 0,
  };

  if (!isPar3) {
    const tee = TEE[next() ?? ''];
    if (!tee) return fail('After the score, add the tee result: F, L, R, S or P');
    fields.teeResult = tee;
    i++;
    const m = /^(\d+)([a-z]?)$/.exec(next() ?? '');
    const lie = m ? APPROACH_LIE[m[2] ?? ''] : undefined;
    if (!m || !lie) return fail('Add the approach yards, e.g. "150" or "165r"');
    fields.approachYards = Number(m[1]);
    fields.approachLie = lie;
    i++;
  }

  const green = next() ?? '';
  if (GIR.has(green)) fields.gir = true;
  else if (MISS[green]) fields.missDirection = MISS[green];
  else return fail('Add the green: ✓ if on in regulation, or L, R, Lg, Sh');
  i++;

  const atRe = /^(\d+)@(\d+)([a-z]?)$/;
  const shortGame = atRe.exec(next() ?? '');
  const afterShort = tokens[i + 1];
  // Two "n@d" tokens in a row: the first is the short game, the second the putts.
  if (shortGame && afterShort !== undefined && /^\d+(@\d+)?$/.test(afterShort)) {
    const lie = SHORT_LIE[shortGame[3] ?? ''];
    if (!lie) return fail('Short-game lie must be f, r or s (none = fairway)');
    fields.shortGameShots = Number(shortGame[1]);
    fields.shortGameYards = Number(shortGame[2]);
    fields.shortGameLie = lie;
    i++;
  }

  const putts = /^(\d+)(?:@(\d+))?$/.exec(next() ?? '');
  if (!putts) return fail('Add the putts, e.g. "2@20" (or "0" if you holed out off the green)');
  fields.putts = Number(putts[1]);
  fields.firstPuttFeet = putts[2] === undefined ? null : Number(putts[2]);
  if (fields.putts > 0 && fields.firstPuttFeet === null) {
    return fail('Add the first-putt distance, e.g. "2@20"');
  }
  i++;

  const pen = /^\+(\d+)$/.exec(next() ?? '');
  if (pen) {
    fields.penalties = Number(pen[1]);
    i++;
  }
  if (i < tokens.length) return fail(`Unexpected "${tokens[i] ?? ''}"`);
  return { ok: true, fields };
}
