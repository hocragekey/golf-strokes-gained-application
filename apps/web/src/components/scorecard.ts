import {
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
  approachYards: string;
  approachLie: string;
  gir: boolean;
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
  approachYards: '',
  approachLie: 'fairway',
  gir: false,
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
    approachYards: str(entry.approachYards),
    approachLie: entry.approachLie,
    gir: entry.gir,
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

export function draftToInput(d: HoleDraft, hole: CourseHole): HoleEntryInput {
  const isPar3 = hole.par === 3;
  return {
    holeNumber: hole.number,
    score: num(d.score) ?? Number.NaN,
    teeResult: isPar3 ? null : (opt(d.teeResult) as HoleEntryInput['teeResult']),
    approachYards: isPar3 ? null : num(d.approachYards),
    approachLie: (isPar3 ? 'tee' : d.approachLie) as HoleEntryInput['approachLie'],
    gir: d.gir,
    missDirection: d.gir ? null : (opt(d.missDirection) as HoleEntryInput['missDirection']),
    shortGameShots: num(d.shortGameShots) ?? 0,
    shortGameYards: num(d.shortGameYards),
    shortGameLie: opt(d.shortGameLie) as HoleEntryInput['shortGameLie'],
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

/** Holes must be filled from hole 1 without gaps; trailing blank rows are ignored. */
export function validateCard(
  drafts: readonly HoleDraft[],
  holes: readonly CourseHole[],
): { entries: HoleEntry[]; rowErrors: Record<string, string>[]; error: string | null } {
  let lastFilled = -1;
  drafts.forEach((d, i) => {
    if (!isBlank(d)) lastFilled = i;
  });
  if (lastFilled < 0) return { entries: [], rowErrors: [], error: 'Enter at least one hole' };

  const entries: HoleEntry[] = [];
  const rowErrors = drafts.map((d, i) => {
    const hole = holes[i];
    if (i > lastFilled || !hole) return {};
    if (isBlank(d)) return { score: 'Fill holes in order from hole 1' };
    const result = validateRow(d, hole);
    if (result.entry) entries.push(result.entry);
    return result.errors;
  });
  const bad = rowErrors.filter((e) => Object.keys(e).length > 0).length;
  return {
    entries,
    rowErrors,
    error: bad > 0 ? `${bad} hole${bad === 1 ? '' : 's'} need attention` : null,
  };
}
