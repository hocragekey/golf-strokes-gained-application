import type { Course, CourseHole, HoleEntry } from './schemas.js';

export interface EntryIssue {
  path: string;
  message: string;
}

/**
 * Long-game strokes played before reaching the approach position (tee shots, lay-ups,
 * punch-outs). Penalty strokes are excluded.
 */
export function strokesBeforeApproach(entry: HoleEntry): number {
  return entry.score - entry.putts - entry.shortGameShots - entry.penalties - 1;
}

/** Cross-field rules that keep a hole entry internally consistent with the course hole. */
export function holeEntryIssues(hole: CourseHole, entry: HoleEntry): EntryIssue[] {
  const issues: EntryIssue[] = [];
  const add = (path: string, message: string) => issues.push({ path, message });
  const isPar3 = hole.par === 3;

  if (isPar3 && entry.teeResult !== null) {
    add('teeResult', 'Leave tee result blank on par 3s (the tee shot is the approach)');
  }
  if (!isPar3 && entry.teeResult === null) add('teeResult', 'Tee result is required');
  if (!isPar3 && entry.approachYards === null) {
    add('approachYards', 'Approach distance is required');
  }
  if (!isPar3 && entry.approachLie === 'tee') {
    add('approachLie', 'Approach lie can only be "tee" on par 3s');
  }
  if (entry.approachYards !== null && entry.approachYards > hole.yardage + 50) {
    add('approachYards', 'Approach distance is longer than the hole');
  }

  if (entry.putts > 0 && entry.firstPuttFeet === null) {
    add('firstPuttFeet', 'First putt distance is required when you putted');
  }
  if (entry.putts === 0 && entry.firstPuttFeet !== null) {
    add('firstPuttFeet', 'No putts recorded, so leave first putt blank');
  }

  if (entry.shortGameShots > 0) {
    if (entry.shortGameYards === null) add('shortGameYards', 'Short-game distance is required');
    if (entry.shortGameLie === null) add('shortGameLie', 'Short-game lie is required');
  } else if (entry.shortGameYards !== null || entry.shortGameLie !== null) {
    add('shortGameShots', 'Record the number of short-game shots or clear the distance and lie');
  }

  if (entry.gir && entry.shortGameShots > 0) {
    add('gir', 'A green in regulation should not need short-game shots');
  }
  if (entry.gir && entry.missDirection !== null) {
    add('missDirection', 'Miss direction only applies when you missed the green');
  }

  const before = strokesBeforeApproach(entry);
  const minimum = isPar3 ? 0 : 1;
  if (before < minimum) {
    add(
      'score',
      `Score is too low for the shots recorded (needs at least ${entry.score - before + minimum})`,
    );
  }
  return issues;
}

/** Validates every hole of a round against the course it was played on. */
export function roundIssues(holes: readonly HoleEntry[], course: Course): EntryIssue[] {
  if (holes.length > course.holes.length) {
    return [{ path: 'holes', message: `${course.name} only has ${course.holes.length} holes` }];
  }
  return holes.flatMap((entry, i) => {
    const hole = course.holes[i];
    return hole
      ? holeEntryIssues(hole, entry).map((issue) => ({
          ...issue,
          path: `holes.${i}.${issue.path}`,
        }))
      : [];
  });
}
