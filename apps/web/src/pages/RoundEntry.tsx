import {
  APPROACH_LIES,
  holeEntrySchema,
  MISS_DIRECTIONS,
  parseHoleNotation,
  SHORT_GAME_LIES,
  TEE_RESULTS,
  type CourseHole,
  type RoundDetail,
} from '@golf-sg/shared';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useCourses, useRound, useSaveRound } from '../data/hooks';
import {
  draftFromEntry,
  emptyDraft,
  emptyLayout,
  isBlank,
  layoutFromHole,
  parseLayout,
  validateCard,
  validateRow,
  type HoleDraft,
  type LayoutDraft,
} from '../components/scorecard';
import { formatToPar } from '../format';

const LABELS: Record<string, string> = {
  fairway: 'Fairway',
  left: 'Left',
  right: 'Right',
  short: 'Short',
  long: 'Long',
  penalty: 'Penalty / OB',
  rough: 'Rough',
  sand: 'Bunker',
  recovery: 'Trees / recovery',
  fringe: 'Fringe',
};
const label = (value: string): string => LABELS[value] ?? value;

const SCORE_NAMES: Record<number, string> = {
  [-3]: 'Albatross',
  [-2]: 'Eagle',
  [-1]: 'Birdie',
  0: 'Par',
  1: 'Bogey',
  2: 'Double',
  3: 'Triple',
};

const today = (): string => {
  const d = new Date();
  return `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

type Step =
  'layout' | 'score' | 'tee' | 'approach' | 'green' | 'short' | 'putts' | 'penalties' | 'review';

/** The questions asked for a hole, in order; par 3s skip the drive and approach distance. */
const stepsFor = (par: number): Step[] =>
  par === 3
    ? ['layout', 'score', 'green', 'short', 'putts', 'penalties', 'review']
    : ['layout', 'score', 'tee', 'approach', 'green', 'short', 'putts', 'penalties', 'review'];

const FIELD_STEP: Record<string, Step> = {
  par: 'layout',
  yardage: 'layout',
  score: 'score',
  teeResult: 'tee',
  approachYards: 'approach',
  approachLie: 'approach',
  gir: 'green',
  missDirection: 'green',
  shortGameShots: 'short',
  shortGameYards: 'short',
  shortGameLie: 'short',
  firstPuttFeet: 'putts',
  putts: 'putts',
  penalties: 'penalties',
};

const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

function Choices<T extends string | number>({
  options,
  selected,
  onPick,
  render = (v) => label(String(v)),
  hint,
  more,
}: {
  options: readonly T[];
  selected: T | null;
  onPick: (value: T) => void;
  render?: (value: T) => ReactNode;
  hint?: (value: T) => string | undefined;
  /** Highest valid count; adds an "Other" box for values beyond the buttons. */
  more?: number;
}) {
  const custom = selected !== null && !options.includes(selected) ? String(selected) : '';
  return (
    <div className="choices">
      {options.map((v) => (
        <button
          key={v}
          type="button"
          className="choice"
          aria-pressed={selected === v}
          onClick={() => {
            onPick(v);
          }}
        >
          <span className="choice-main">{render(v)}</span>
          {hint?.(v) && (
            <>
              {' '}
              <span className="choice-hint">{hint(v)}</span>
            </>
          )}
        </button>
      ))}
      {more !== undefined && (
        <label className="choice choice-more">
          <span className="choice-hint">Other</span>
          <input
            aria-label="Other"
            type="number"
            inputMode="numeric"
            min={0}
            max={more}
            defaultValue={custom}
            key={custom}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            onBlur={(e) => {
              const n = Number(e.currentTarget.value);
              if (e.currentTarget.value !== '' && Number.isInteger(n) && n >= 0 && n <= more) {
                onPick(String(n) as T);
              }
            }}
          />
        </label>
      )}
    </div>
  );
}

function NumberField({
  name,
  value,
  onChange,
  max,
  suffix,
  autoFocus,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  max: number;
  suffix: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="field big-field">
      <span>{name}</span>
      <span className="with-suffix">
        <input
          aria-label={name}
          type="number"
          inputMode="numeric"
          min={1}
          max={max}
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => {
            onChange(e.target.value);
          }}
        />
        <span className="muted">{suffix}</span>
      </span>
    </label>
  );
}

function Question({
  title,
  help,
  children,
}: {
  title: string;
  help?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="question">
      <h3>{title}</h3>
      {help && <p className="muted small">{help}</p>}
      {children}
    </div>
  );
}

/** One-line summary of a hole in card notation, e.g. "5 R 165r Sh 1@15s 1@4". */
function holeLine(d: HoleDraft, par: number): string {
  const lie: Record<string, string> = { rough: 'r', sand: 's', recovery: 't', fringe: 'f' };
  const tee: Record<string, string> = {
    fairway: 'F',
    left: 'L',
    right: 'R',
    short: 'S',
    penalty: 'P',
  };
  const miss: Record<string, string> = { left: 'L', right: 'R', long: 'Lg', short: 'Sh' };
  const parts = [d.score];
  if (par !== 3)
    parts.push(tee[d.teeResult] ?? '?', `${d.approachYards || '?'}${lie[d.approachLie] ?? ''}`);
  parts.push(d.gir ? '✓' : (miss[d.missDirection] ?? '?'));
  if (Number(d.shortGameShots) > 0) {
    parts.push(`${d.shortGameShots}@${d.shortGameYards || '?'}${lie[d.shortGameLie] ?? ''}`);
  }
  parts.push(Number(d.putts) > 0 ? `${d.putts}@${d.firstPuttFeet || '?'}` : d.putts || '?');
  if (Number(d.penalties) > 0) parts.push(`+${d.penalties}`);
  return parts.join(' ');
}

interface Position {
  hole: number;
  step: Step | 'details';
}

function Scorecard({
  existing,
  savedCourses,
}: {
  existing?: RoundDetail;
  savedCourses: { name: string; tees: string; holes: CourseHole[] }[];
}) {
  const navigate = useNavigate();
  const save = useSaveRound(existing?.round.id);
  const r = existing?.round;
  const [courseName, setCourseName] = useState(r?.courseName ?? '');
  const [tees, setTees] = useState(r?.tees ?? '');
  const [playedOn, setPlayedOn] = useState(r?.playedOn ?? today());
  const [notes, setNotes] = useState(r?.notes ?? '');
  const [holeCount, setHoleCount] = useState(r && r.layout.length <= 9 ? 9 : 18);
  const [layout, setLayout] = useState<LayoutDraft[]>(() =>
    Array.from({ length: 18 }, (_, i) => {
      const hole = r?.layout[i];
      return hole ? layoutFromHole(hole) : emptyLayout();
    }),
  );
  const [layoutTouched, setLayoutTouched] = useState(r !== undefined);
  const [drafts, setDrafts] = useState<HoleDraft[]>(() =>
    Array.from({ length: 18 }, (_, i) => {
      const entry = r?.holes[i];
      return entry ? draftFromEntry(entry) : emptyDraft();
    }),
  );
  const [pos, setPos] = useState<Position>({ hole: 0, step: 'details' });
  const [cardLine, setCardLine] = useState('');
  const [lineError, setLineError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const holeLayout = (i: number) => parseLayout(layout[i] ?? emptyLayout(), i + 1);
  const draft = drafts[pos.hole] ?? emptyDraft();
  const lay = layout[pos.hole] ?? emptyLayout();
  const par = Number(lay.par) || 4;
  const steps = stepsFor(par);

  const update = (patch: Partial<HoleDraft>) => {
    setDrafts((prev) => prev.map((d, j) => (j === pos.hole ? { ...d, ...patch } : d)));
  };
  const updateLayout = (patch: Partial<LayoutDraft>) => {
    setLayoutTouched(true);
    setLayout((prev) => prev.map((l, j) => (j === pos.hole ? { ...l, ...patch } : l)));
  };

  const startHole = (hole: number) => {
    const known = parseLayout(layout[hole] ?? emptyLayout(), hole + 1).hole !== undefined;
    const filled = !isBlank(drafts[hole] ?? emptyDraft());
    setCardLine('');
    setLineError(null);
    setPos({ hole, step: filled ? 'review' : known ? 'score' : 'layout' });
  };
  const goTo = (step: Step) => {
    setPos((p) => ({ ...p, step }));
  };
  const advance = (fromPar = par) => {
    setPos((p) => {
      if (p.step === 'details') return p;
      const s = stepsFor(fromPar);
      return { ...p, step: s[Math.min(s.indexOf(p.step) + 1, s.length - 1)] ?? 'review' };
    });
  };
  const back = () => {
    if (pos.step === 'details') return;
    const i = steps.indexOf(pos.step);
    if (i > 0) goTo(steps[i - 1] ?? 'layout');
    else if (pos.hole > 0) setPos({ hole: pos.hole - 1, step: 'review' });
    else setPos({ hole: 0, step: 'details' });
  };

  /** Pre-fills par and yardage when the course name matches one played before. */
  const pickCourse = (name: string, teeName = tees, teesChanged = false) => {
    setCourseName(name);
    if (layoutTouched) return;
    const key = (s: string) => s.trim().toLowerCase();
    const exact = savedCourses.find(
      (c) => key(c.name) === key(name) && key(c.tees) === key(teeName),
    );
    // A new tee name at a known course is a new layout: never swap it back to the saved tees.
    const match =
      exact ?? (teesChanged ? undefined : savedCourses.find((c) => key(c.name) === key(name)));
    if (!match) return;
    if (!teesChanged) setTees(match.tees);
    setHoleCount(match.holes.length > 9 ? 18 : 9);
    setLayout(
      Array.from({ length: 18 }, (_, i) => {
        const hole = match.holes[i];
        return hole ? layoutFromHole(hole) : emptyLayout();
      }),
    );
  };

  const status = (i: number): 'done' | 'error' | 'todo' => {
    const d = drafts[i] ?? emptyDraft();
    if (isBlank(d)) return 'todo';
    if (i === pos.hole && pos.step !== 'review' && pos.step !== 'details') return 'todo';
    const { hole } = holeLayout(i);
    return hole && validateRow(d, hole).entry ? 'done' : 'error';
  };

  const scoreLabel = (i: number): string => {
    const score = drafts[i]?.score ?? '';
    return score === '' ? '·' : score;
  };

  const played = drafts.slice(0, holeCount).filter((d) => !isBlank(d));
  const totalScore = played.reduce((a, d) => a + (Number(d.score) || 0), 0);
  const totalPar = played.reduce((a, _d, i) => a + (Number(layout[i]?.par) || 0), 0);

  async function finish() {
    const holes = Array.from({ length: holeCount }, (_, i) => holeLayout(i).hole);
    const result = validateCard(drafts.slice(0, holeCount), holes);
    setFormError(result.error);
    if (result.error) {
      const bad = result.rowErrors.findIndex((e) => Object.keys(e).length > 0);
      if (bad >= 0) setPos({ hole: bad, step: 'review' });
      return;
    }
    try {
      const saved = await save.mutateAsync({
        courseName,
        tees,
        playedOn,
        notes,
        layout: holes.slice(0, result.entries.length).filter((h) => h !== undefined),
        holes: result.entries,
      });
      void navigate(`/rounds/${saved.round.id}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Save failed');
    }
  }

  const applyLine = () => {
    const parsed = parseHoleNotation(cardLine, par);
    if (!parsed.ok) {
      setLineError(parsed.error);
      return;
    }
    const entry = holeEntrySchema.safeParse({ holeNumber: pos.hole + 1, ...parsed.fields });
    if (!entry.success) {
      setLineError('One of those numbers is out of range');
      return;
    }
    update(draftFromEntry(entry.data));
    setLineError(null);
    setCardLine('');
    goTo('review');
  };

  const n = pos.hole + 1;
  const next = () => {
    advance();
  };

  let body: ReactNode;
  switch (pos.step) {
    case 'details':
      body = (
        <div className="question">
          <h3>{existing ? 'Round details' : 'New round'}</h3>
          <p className="muted small">
            No setup needed: we&apos;ll ask for each hole&apos;s par and yardage as you go. Name the
            course if you want it remembered for next time.
          </p>
          <div className="row">
            <label className="field grow">
              <span>Course (optional)</span>
              <input
                aria-label="Course (optional)"
                list="saved-courses"
                value={courseName}
                placeholder="e.g. Pebble Creek"
                onChange={(e) => {
                  pickCourse(e.target.value);
                }}
              />
              <datalist id="saved-courses">
                {savedCourses.map((c) => (
                  <option key={`${c.name}-${c.tees}`} value={c.name}>
                    {c.tees}
                  </option>
                ))}
              </datalist>
            </label>
            <label className="field">
              <span>Tees</span>
              <input
                value={tees}
                placeholder="White"
                onChange={(e) => {
                  setTees(e.target.value);
                  if (courseName) pickCourse(courseName, e.target.value, true);
                }}
              />
            </label>
            <label className="field">
              <span>Date played</span>
              <input
                type="date"
                value={playedOn}
                onChange={(e) => {
                  setPlayedOn(e.target.value);
                }}
              />
            </label>
          </div>
          <fieldset className="field">
            <legend>Holes</legend>
            <Choices
              options={[18, 9]}
              selected={holeCount}
              render={(v) => `${String(v)} holes`}
              onPick={setHoleCount}
            />
          </fieldset>
          <label className="field">
            <span>Notes</span>
            <input
              value={notes}
              placeholder="Windy, new driver…"
              onChange={(e) => {
                setNotes(e.target.value);
              }}
            />
          </label>
          <div className="actions">
            <button
              type="button"
              className="primary big"
              onClick={() => {
                startHole(0);
              }}
            >
              {existing ? 'Review holes' : 'Start with hole 1'}
            </button>
          </div>
        </div>
      );
      break;
    case 'layout': {
      const { errors } = holeLayout(pos.hole);
      body = (
        <Question
          title={`Hole ${String(n)}: par and yardage?`}
          help="Copy them from the scorecard."
        >
          <fieldset className="field">
            <legend>Par</legend>
            <Choices
              options={['3', '4', '5', '6']}
              selected={lay.par}
              render={(v) => `Par ${v}`}
              onPick={(v) => {
                updateLayout({ par: v });
              }}
            />
          </fieldset>
          <NumberField
            name="Yards"
            suffix="yds"
            max={800}
            value={lay.yardage}
            onChange={(v) => {
              updateLayout({ yardage: v });
            }}
          />
          {lay.yardage !== '' && errors.yardage && <p className="field-error">{errors.yardage}</p>}
          <div className="actions">
            <button
              type="button"
              className="primary big"
              disabled={Object.keys(errors).length > 0}
              onClick={() => {
                advance(Number(lay.par));
              }}
            >
              Next
            </button>
          </div>
        </Question>
      );
      break;
    }
    case 'score':
      body = (
        <Question title="What did you score?" help="Every stroke, penalties included.">
          <Choices
            options={range(Math.max(1, par - 2), par + 5).map(String)}
            more={20}
            selected={draft.score}
            render={(v) => v}
            hint={(v) => SCORE_NAMES[Number(v) - par]}
            onPick={(v) => {
              update({ score: v });
              next();
            }}
          />
        </Question>
      );
      break;
    case 'tee':
      body = (
        <Question title="Where did your drive finish?">
          <Choices
            options={TEE_RESULTS}
            selected={draft.teeResult || null}
            onPick={(v) => {
              update({
                teeResult: v,
                penalties: v === 'penalty' && draft.penalties === '0' ? '1' : draft.penalties,
              });
              next();
            }}
          />
        </Question>
      );
      break;
    case 'approach':
      body = (
        <Question
          title="How far was your shot into the green?"
          help="Yards to the pin, and where you hit it from."
        >
          <NumberField
            name="Approach yards"
            suffix="yds"
            max={700}
            autoFocus
            value={draft.approachYards}
            onChange={(v) => {
              update({ approachYards: v });
            }}
          />
          <fieldset className="field">
            <legend>Hit from</legend>
            <Choices
              options={APPROACH_LIES.filter((l) => l !== 'tee')}
              selected={draft.approachLie}
              onPick={(v) => {
                update({ approachLie: v });
              }}
            />
          </fieldset>
          <div className="actions">
            <button
              type="button"
              className="primary big"
              disabled={draft.approachYards === ''}
              onClick={next}
            >
              Next
            </button>
          </div>
        </Question>
      );
      break;
    case 'green':
      body = (
        <Question
          title="Did you hit the green in regulation?"
          help={`On the green in ${String(par - 2)} or fewer. If not, where did you miss?`}
        >
          <Choices
            options={['gir', ...MISS_DIRECTIONS]}
            selected={draft.gir ? 'gir' : draft.missDirection || null}
            render={(v) => (v === 'gir' ? 'Yes, on the green' : `Missed ${v}`)}
            onPick={(v) => {
              update(
                v === 'gir' ? { gir: true, missDirection: '' } : { gir: false, missDirection: v },
              );
              next();
            }}
          />
        </Question>
      );
      break;
    case 'short': {
      const shots = Number(draft.shortGameShots);
      body = (
        <Question
          title="How many chips, pitches or bunker shots?"
          help="Shots from within about 50 yards that didn't start on the green."
        >
          <Choices
            options={['0', '1', '2', '3', '4']}
            more={10}
            selected={draft.shortGameShots}
            render={(v) => (v === '0' ? 'None' : v)}
            onPick={(v) => {
              update({
                shortGameShots: v,
                ...(v === '0' ? { shortGameYards: '', shortGameLie: '' } : {}),
              });
              if (v === '0') next();
            }}
          />
          {shots > 0 && (
            <>
              <NumberField
                name="Short-game yards"
                suffix="yds to the pin"
                max={60}
                autoFocus
                value={draft.shortGameYards}
                onChange={(v) => {
                  update({ shortGameYards: v });
                }}
              />
              <fieldset className="field">
                <legend>First one from</legend>
                <Choices
                  options={SHORT_GAME_LIES}
                  selected={draft.shortGameLie || 'fairway'}
                  onPick={(v) => {
                    update({ shortGameLie: v });
                  }}
                />
              </fieldset>
              <div className="actions">
                <button
                  type="button"
                  className="primary big"
                  disabled={draft.shortGameYards === ''}
                  onClick={next}
                >
                  Next
                </button>
              </div>
            </>
          )}
        </Question>
      );
      break;
    }
    case 'putts': {
      const putts = Number(draft.putts);
      body = (
        <Question title="How many putts?">
          <Choices
            options={['0', '1', '2', '3', '4']}
            more={10}
            selected={draft.putts}
            render={(v) => (v === '0' ? '0 (holed out)' : v)}
            onPick={(v) => {
              update({ putts: v, ...(v === '0' ? { firstPuttFeet: '' } : {}) });
              if (v === '0') next();
            }}
          />
          {draft.putts !== '' && putts > 0 && (
            <>
              <NumberField
                name="First putt"
                suffix="feet"
                max={150}
                autoFocus
                value={draft.firstPuttFeet}
                onChange={(v) => {
                  update({ firstPuttFeet: v });
                }}
              />
              <div className="actions">
                <button
                  type="button"
                  className="primary big"
                  disabled={draft.firstPuttFeet === ''}
                  onClick={next}
                >
                  Next
                </button>
              </div>
            </>
          )}
        </Question>
      );
      break;
    }
    case 'penalties':
      body = (
        <Question title="Any penalty strokes?" help="OB, water, unplayable.">
          <Choices
            options={['0', '1', '2', '3']}
            more={10}
            selected={draft.penalties}
            render={(v) => (v === '0' ? 'None' : `+${v}`)}
            onPick={(v) => {
              update({ penalties: v });
              next();
            }}
          />
        </Question>
      );
      break;
    case 'review': {
      const { hole, errors: layoutErrors } = holeLayout(pos.hole);
      const errors = { ...layoutErrors, ...(hole ? validateRow(draft, hole).errors : {}) };
      const isLast = pos.hole + 1 >= holeCount;
      body = (
        <Question title={`Hole ${String(n)} summary`}>
          <p className="hole-line">
            <span className="muted small">Card line</span>
            <code>{holeLine(draft, par)}</code>
          </p>
          {Object.keys(errors).length > 0 ? (
            <ul className="field-errors" role="alert">
              {Object.entries(errors).map(([field, message]) => (
                <li key={field}>
                  {message}{' '}
                  <button
                    type="button"
                    className="link"
                    onClick={() => {
                      goTo(FIELD_STEP[field] ?? 'score');
                    }}
                  >
                    Fix
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ok">Looks good.</p>
          )}
          <div className="actions">
            {isLast ? (
              <button
                type="button"
                className="primary big"
                disabled={save.isPending}
                onClick={() => void finish()}
              >
                {existing ? 'Save round' : 'Calculate strokes gained'}
              </button>
            ) : (
              <button
                type="button"
                className="primary big"
                onClick={() => {
                  startHole(pos.hole + 1);
                }}
              >
                Next hole
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                goTo('score');
              }}
            >
              Edit answers
            </button>
          </div>
        </Question>
      );
      break;
    }
  }

  return (
    <div className="entry">
      <div className="entry-main">
        {pos.step !== 'details' && (
          <div className="hole-bar">
            <button type="button" className="link" onClick={back}>
              ← Back
            </button>
            <span className="hole-meta">
              <strong>Hole {n}</strong>
              {holeLayout(pos.hole).hole && (
                <button
                  type="button"
                  className="link"
                  onClick={() => {
                    goTo('layout');
                  }}
                >
                  Par {lay.par} · {lay.yardage} yds
                </button>
              )}
            </span>
            <span className="muted small">
              {played.length > 0
                ? `Thru ${String(played.length)} · ${String(totalScore)} (${formatToPar(totalScore - totalPar)})`
                : ''}
            </span>
          </div>
        )}
        <section className="card question-card">{body}</section>
        {pos.step !== 'details' && pos.step !== 'review' && (
          <details className="card-line">
            <summary>Type the card line instead</summary>
            <div className="row">
              <label className="field grow">
                <span>Card line</span>
                <input
                  value={cardLine}
                  placeholder={par === 3 ? '3 ✓ 2@25' : '5 R 165r Sh 1@15s 1@4'}
                  onChange={(e) => {
                    setCardLine(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') applyLine();
                  }}
                />
              </label>
              <button type="button" onClick={applyLine}>
                Apply
              </button>
            </div>
            {lineError && <p className="field-error">{lineError}</p>}
            <p className="muted small">
              Same order as the <Link to="/guide">card guide</Link>.
            </p>
          </details>
        )}
        {formError && (
          <p className="form-error" role="alert">
            {formError}
          </p>
        )}
      </div>
      <aside className="card mini-card" aria-label="Scorecard">
        <div className="card-header">
          <h3>{courseName || 'Scorecard'}</h3>
          <button
            type="button"
            className="link"
            onClick={() => {
              setPos({ hole: 0, step: 'details' });
            }}
          >
            Details
          </button>
        </div>
        <ol className="hole-strip">
          {range(0, holeCount - 1).map((i) => (
            <li key={i}>
              <button
                type="button"
                aria-label={`Go to hole ${String(i + 1)}`}
                aria-current={pos.step !== 'details' && pos.hole === i ? 'step' : undefined}
                className={`hole-dot ${status(i)}`}
                onClick={() => {
                  startHole(i);
                }}
              >
                <span className="hole-num">{i + 1}</span>
                <span className="hole-score">{scoreLabel(i)}</span>
              </button>
            </li>
          ))}
        </ol>
        {played.length > 0 && (
          <button
            type="button"
            className="primary wide"
            disabled={save.isPending}
            onClick={() => void finish()}
          >
            {existing
              ? 'Save round'
              : `Finish after ${String(played.length)} hole${played.length === 1 ? '' : 's'}`}
          </button>
        )}
      </aside>
    </div>
  );
}

export function RoundEntry() {
  const { id } = useParams();
  const courses = useCourses();
  const round = useRound(id);

  if (courses.isPending || (id !== undefined && round.isPending)) {
    return <p className="muted">Loading…</p>;
  }
  if (courses.isError || round.isError) {
    return (
      <p className="form-error" role="alert">
        Failed to load: {(courses.error ?? round.error)?.message}
      </p>
    );
  }
  return (
    <div className="stack">
      <h2>{id !== undefined ? 'Edit round' : 'Enter round'}</h2>
      <Scorecard existing={round.data} savedCourses={courses.data} />
    </div>
  );
}
