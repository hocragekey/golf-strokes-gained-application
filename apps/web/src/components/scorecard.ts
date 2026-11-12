import {
  courseHoleSchema,
  holeEntryIssues,
  holeEntrySchema,
  type CourseHole,
  type HoleEntry,
  type HoleEntryInput,
} from '@golf-sg/shared';

/** Form state for one scorecard row; every field is a raw string from an input. */
export interface HoleDraft {
  score: string;
  teeResult: string;
  driveYardsLeft: string;
  approachYards: string;
  approachLie: string;
  missDirection: string;
  shortGameShots: string;
  shortGameYards: string;
  shortGameLie: string;
  firstPuttFeet: string;
  putts: string;
  penalties: string;
}

export const emptyDraft = (): HoleDraft => ({
  score: '',
  teeResult: '',
  driveYardsLeft: '',
  approachYards: '',
  approachLie: 'fairway',
  missDirection: '',
  shortGameShots: '0',
  shortGameYards: '',
  shortGameLie: '',
  firstPuttFeet: '',
  putts: '',
  penalties: '0',
});

const str = (v: number | string | null): string => (v === null ? '' : String(v));

export function draftFromEntry(entry: HoleEntry): HoleDraft {
  return {
    score: str(entry.score),
    teeResult: str(entry.teeResult),
    driveYardsLeft: str(entry.driveYardsLeft),
    approachYards: str(entry.approachYards),
    approachLie: entry.approachLie,
    missDirection: str(entry.missDirection),
    shortGameShots: str(entry.shortGameShots),
    shortGameYards: str(entry.shortGameYards),
    shortGameLie: str(entry.shortGameLie),
    firstPuttFeet: str(entry.firstPuttFeet),
    putts: str(entry.putts),
    penalties: str(entry.penalties),
  };
}

const num = (v: string): number | null => (v.trim() === '' ? null : Number(v));
const opt = (v: string): string | null => (v === '' ? null : v);

export const isBlank = (d: HoleDraft): boolean => d.score.trim() === '';

/** On the green in regulation, worked out from the score and putts (no need to ask). */
export function isGir(d: HoleDraft, par: number): boolean {
  const score = num(d.score);
  const putts = num(d.putts);
  if (score === null || putts === null || (num(d.shortGameShots) ?? 0) > 0) return false;
  return score - Math.max(putts, 1) <= par - 2;
}

export function draftToInput(d: HoleDraft, hole: CourseHole): HoleEntryInput {
  const isPar3 = hole.par === 3;
  const gir = isGir(d, hole.par);
  return {
    holeNumber: hole.number,
    score: num(d.score) ?? Number.NaN,
    teeResult: isPar3 ? null : (opt(d.teeResult) as HoleEntryInput['teeResult']),
    driveYardsLeft: isPar3 ? null : num(d.driveYardsLeft),
    approachYards: isPar3 ? null : num(d.approachYards),
    approachLie: (isPar3 ? 'tee' : d.approachLie) as HoleEntryInput['approachLie'],
    gir,
    missDirection: gir ? null : (opt(d.missDirection) as HoleEntryInput['missDirection']),
    shortGameShots: num(d.shortGameShots) ?? 0,
    shortGameYards: num(d.shortGameYards),
    // Card notation: no lie letter means the first short-game shot was from the fairway.
    shortGameLie: (opt(d.shortGameLie) ??
      ((num(d.shortGameShots) ?? 0) > 0 ? 'fairway' : null)) as HoleEntryInput['shortGameLie'],
    firstPuttFeet: num(d.firstPuttFeet),
    putts: num(d.putts) ?? Number.NaN,
    penalties: num(d.penalties) ?? 0,
  };
}

export interface RowResult {
  entry?: HoleEntry;
  errors: Record<string, string>;
}

/** Validates one row with the shared schema plus the cross-field strokes-gained rules. */
export function validateRow(d: HoleDraft, hole: CourseHole): RowResult {
  const parsed = holeEntrySchema.safeParse(draftToInput(d, hole));
  if (!parsed.success) {
    return {
      errors: Object.fromEntries(
        parsed.error.issues.map((i) => [String(i.path[0]), 'Enter a valid number']),
      ),
    };
  }
  const issues = holeEntryIssues(hole, parsed.data);
  return issues.length === 0
    ? { entry: parsed.data, errors: {} }
    : { errors: Object.fromEntries(issues.map((i) => [i.path, i.message])) };
}

/** Par and yardage for one hole as typed from the scorecard. */
export interface LayoutDraft {
  par: string;
  yardage: string;
}

export const emptyLayout = (): LayoutDraft => ({ par: '4', yardage: '' });

export const layoutFromHole = (hole: CourseHole): LayoutDraft => ({
  par: String(hole.par),
  yardage: String(hole.yardage),
});

/** Parses a hole's par and yardage; returns field errors when they aren't usable yet. */
export function parseLayout(
  draft: LayoutDraft,
  number: number,
): { hole?: CourseHole; errors: Record<string, string> } {
  const parsed = courseHoleSchema.safeParse({
    number,
    par: Number(draft.par),
    yardage: draft.yardage.trim() === '' ? Number.NaN : Number(draft.yardage),
  });
  if (parsed.success) return { hole: parsed.data, errors: {} };
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const field = String(issue.path[0]);
    errors[field] =
      field === 'par' ? 'Pick the par from the card' : 'Enter the yardage from the card (50–800)';
  }
  return { errors };
}

/** Holes must be filled from hole 1 without gaps; trailing blank rows are ignored. */
export function validateCard(
  drafts: readonly HoleDraft[],
  holes: readonly (CourseHole | undefined)[],
): { entries: HoleEntry[]; rowErrors: Record<string, string>[]; error: string | null } {
  let lastFilled = -1;
  drafts.forEach((d, i) => {
    if (!isBlank(d)) lastFilled = i;
  });
  if (lastFilled < 0) return { entries: [], rowErrors: [], error: 'Enter at least one hole' };

  const entries: HoleEntry[] = [];
  const rowErrors = drafts.map((d, i) => {
    const hole = holes[i];
    if (i > lastFilled) return {};
    if (isBlank(d)) return { score: 'Fill holes in order from hole 1' };
    if (!hole) return { yardage: 'Enter the par and yardage from the card' };
    const result = validateRow(d, hole);
    if (result.entry) entries.push(result.entry);
    return result.errors;
  });
  const bad = rowErrors.filter((e) => Object.keys(e).length > 0).length;
  if (bad === 0 && entries.length !== lastFilled + 1) {
    return { entries, rowErrors, error: 'Enter the par and yardage for every played hole' };
  }
  return {
    entries,
    rowErrors,
    error: bad > 0 ? `${bad} hole${bad === 1 ? '' : 's'} need attention` : null,
  };
}
