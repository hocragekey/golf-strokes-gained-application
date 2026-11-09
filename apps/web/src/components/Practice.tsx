import { CATEGORY_LABELS, type CategoryKey, type SgCategories } from '@golf-sg/shared';
import { Link } from 'react-router';
import { SgValue } from './Sg';

/** A simple range or practice-green drill for each strokes-gained category. */
export const DRILLS: Record<CategoryKey, { name: string; how: string }> = {
  offTheTee: {
    name: 'Fairway finder',
    how: 'Pick two targets 30 yards apart as a fairway. Hit 14 drives with a full routine and count how many finish between them.',
  },
  approach: {
    name: 'Distance ladder',
    how: 'Hit 3 balls each to 75, 100, 125 and 150 yards. Score a point for every ball that finishes within 20 feet.',
  },
  aroundTheGreen: {
    name: 'Up-and-down nine',
    how: 'Drop 9 balls around the green: fringe, rough and bunker. Chip and putt each one out and count how many you get down in two.',
  },
  putting: {
    name: 'Circle and lag',
    how: 'Make 10 in a row from 3 feet around the hole, then roll 5 putts from 30–40 feet and try to stop each inside 3 feet.',
  },
};

const KEYS = Object.keys(CATEGORY_LABELS) as CategoryKey[];

export const weakest = (sg: SgCategories): CategoryKey =>
  KEYS.reduce((worst, key) => (sg[key] < sg[worst] ? key : worst));

/** The single most valuable thing to practise next, with a drill to do it. */
export function PracticeFirst({
  category,
  value,
  focus,
  per,
}: {
  category: CategoryKey;
  value: number;
  focus?: string;
  per: string;
}) {
  const drill = DRILLS[category];
  return (
    <section className="card practice-first" aria-label="Practice this first">
      <p className="eyebrow">Practice this first</p>
      <h3>
        {CATEGORY_LABELS[category]} <SgValue value={value} />
        <span className="muted small"> {per}</span>
      </h3>
      {focus && <p className="muted">{focus}</p>}
      <div className="drill">
        <strong>Drill: {drill.name}</strong>
        <p>{drill.how}</p>
      </div>
      <Link className="small" to="/guide">
        Keep marking your card so we can track it
      </Link>
    </section>
  );
}
