import {
  APPROACH_LIES,
  MISS_DIRECTIONS,
  SHORT_GAME_LIES,
  TEE_RESULTS,
  type Course,
  type RoundDetail,
} from '@golf-sg/shared';
import { useState, type SubmitEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useCourses, useRound, useSaveRound } from '../data/hooks';
import { draftFromEntry, emptyDraft, validateCard, type HoleDraft } from '../components/scorecard';

const LABELS: Record<string, string> = {
  fairway: 'Fairway',
  left: 'Left',
  right: 'Right',
  short: 'Short',
  long: 'Long',
  penalty: 'Penalty/OB',
  rough: 'Rough',
  sand: 'Bunker',
  recovery: 'Trees/recovery',
  fringe: 'Fringe',
  tee: 'Tee',
};

const label = (value: string): string => LABELS[value] ?? value;
const today = (): string => {
  const d = new Date();
  return `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function Options({ values, blank }: { values: readonly string[]; blank?: string }) {
  return (
    <>
      {blank !== undefined && <option value="">{blank}</option>}
      {values.map((v) => (
        <option key={v} value={v}>
          {label(v)}
        </option>
      ))}
    </>
  );
}

function Scorecard({ courses, existing }: { courses: Course[]; existing?: RoundDetail }) {
  const navigate = useNavigate();
  const save = useSaveRound(existing?.round.id);
  const [courseId, setCourseId] = useState(existing?.course.id ?? courses[0]?.id ?? '');
  const [playedOn, setPlayedOn] = useState(existing?.round.playedOn ?? today());
  const [notes, setNotes] = useState(existing?.round.notes ?? '');
  const course = courses.find((c) => c.id === courseId);
  const [drafts, setDrafts] = useState<HoleDraft[]>(() =>
    Array.from({ length: 18 }, (_, i) => {
      const entry = existing?.round.holes.find((h) => h.holeNumber === i + 1);
      return entry ? draftFromEntry(entry) : emptyDraft();
    }),
  );
  const [rowErrors, setRowErrors] = useState<Record<string, string>[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  if (!course) return <p className="muted">Select a course.</p>;

  const update = (i: number, patch: Partial<HoleDraft>) => {
    setDrafts((prev) => prev.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  };

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!course) return;
    const result = validateCard(drafts.slice(0, course.holes.length), course.holes);
    setRowErrors(result.rowErrors);
    setFormError(result.error);
    if (result.error) return;
    try {
      const saved = await save.mutateAsync({
        courseId: course.id,
        playedOn,
        notes,
        holes: result.entries,
      });
      void navigate(`/rounds/${saved.round.id}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Save failed');
    }
  }

  const totals = drafts
    .slice(0, course.holes.length)
    .reduce((a, d) => a + (Number(d.score) || 0), 0);

  return (
    <form className="stack" onSubmit={(e) => void handleSubmit(e)} noValidate>
      <section className="card">
        <div className="row">
          <label className="field">
            <span>Course</span>
            <select
              value={courseId}
              disabled={existing !== undefined}
              onChange={(e) => {
                setCourseId(e.target.value);
              }}
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.tees ? ` (${c.tees})` : ''}
                </option>
              ))}
            </select>
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
          <label className="field grow">
            <span>Notes</span>
            <input
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
              }}
              placeholder="Windy, new driver…"
            />
          </label>
        </div>
        <p className="muted small">
          Fill holes in order; leave trailing holes blank for a partial round. Not sure what a field
          means? See the <Link to="/guide">card guide</Link>.
        </p>
      </section>
      <section className="card">
        <div className="table-scroll">
          <table className="table scorecard">
            <thead>
              <tr>
                <th>Hole</th>
                <th>Score</th>
                <th>Tee shot</th>
                <th>Approach yds</th>
                <th>Approach lie</th>
                <th>GIR</th>
                <th>Missed</th>
                <th>Short-game shots</th>
                <th>SG yds</th>
                <th>SG lie</th>
                <th>1st putt ft</th>
                <th>Putts</th>
                <th>Pen</th>
              </tr>
            </thead>
            <tbody>
              {course.holes.map((hole, i) => {
                const d = drafts[i] ?? emptyDraft();
                const errors = rowErrors[i] ?? {};
                const isPar3 = hole.par === 3;
                const name = (field: string) => `Hole ${hole.number} ${field}`;
                const cls = (field: string) => (errors[field] ? 'invalid' : undefined);
                const num = (field: keyof HoleDraft, max: number, disabled = false) => (
                  <input
                    aria-label={name(field)}
                    aria-invalid={Boolean(errors[field])}
                    className={cls(field)}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={max}
                    disabled={disabled}
                    value={String(d[field])}
                    onChange={(e) => {
                      update(i, { [field]: e.target.value });
                    }}
                  />
                );
                const messages = Object.values(errors);
                return [
                  <tr key={hole.number}>
                    <th scope="row">
                      {hole.number}
                      <div className="muted small">
                        Par {hole.par} · {hole.yardage}
                      </div>
                    </th>
                    <td>{num('score', 20)}</td>
                    <td>
                      {isPar3 ? (
                        <span className="muted">—</span>
                      ) : (
                        <select
                          aria-label={name('teeResult')}
                          className={cls('teeResult')}
                          value={d.teeResult}
                          onChange={(e) => {
                            update(i, { teeResult: e.target.value });
                          }}
                        >
                          <Options values={TEE_RESULTS} blank="–" />
                        </select>
                      )}
                    </td>
                    <td>
                      {isPar3 ? <span className="muted">tee</span> : num('approachYards', 700)}
                    </td>
                    <td>
                      {isPar3 ? (
                        <span className="muted">—</span>
                      ) : (
                        <select
                          aria-label={name('approachLie')}
                          value={d.approachLie}
                          onChange={(e) => {
                            update(i, { approachLie: e.target.value });
                          }}
                        >
                          <Options values={APPROACH_LIES.filter((l) => l !== 'tee')} />
                        </select>
                      )}
                    </td>
                    <td>
                      <input
                        aria-label={name('gir')}
                        type="checkbox"
                        checked={d.gir}
                        onChange={(e) => {
                          update(i, { gir: e.target.checked });
                        }}
                      />
                    </td>
                    <td>
                      <select
                        aria-label={name('missDirection')}
                        className={cls('missDirection')}
                        disabled={d.gir}
                        value={d.gir ? '' : d.missDirection}
                        onChange={(e) => {
                          update(i, { missDirection: e.target.value });
                        }}
                      >
                        <Options values={MISS_DIRECTIONS} blank="–" />
                      </select>
                    </td>
                    <td>{num('shortGameShots', 10)}</td>
                    <td>{num('shortGameYards', 60, d.shortGameShots === '0')}</td>
                    <td>
                      <select
                        aria-label={name('shortGameLie')}
                        className={cls('shortGameLie')}
                        disabled={d.shortGameShots === '0'}
                        value={d.shortGameLie}
                        onChange={(e) => {
                          update(i, { shortGameLie: e.target.value });
                        }}
                      >
                        <Options values={SHORT_GAME_LIES} blank="–" />
                      </select>
                    </td>
                    <td>{num('firstPuttFeet', 150)}</td>
                    <td>{num('putts', 10)}</td>
                    <td>{num('penalties', 10)}</td>
                  </tr>,
                  messages.length > 0 && (
                    <tr key={`${hole.number}-errors`} className="row-errors">
                      <td colSpan={13} role="alert">
                        Hole {hole.number}: {messages.join(' · ')}
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
            <tfoot>
              <tr>
                <th>Total</th>
                <th>{totals || '—'}</th>
                <td colSpan={11} />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
      {formError && (
        <p className="form-error" role="alert">
          {formError}
        </p>
      )}
      <div className="actions">
        <button type="submit" className="primary" disabled={save.isPending}>
          {existing ? 'Save round' : 'Calculate strokes gained'}
        </button>
        <Link className="button" to={existing ? `/rounds/${existing.round.id}` : '/rounds'}>
          Cancel
        </Link>
      </div>
    </form>
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
      {courses.data.length === 0 ? (
        <section className="card">
          <p>
            Add a <Link to="/courses">course</Link> first so we know the par and yardage of each
            hole.
          </p>
        </section>
      ) : (
        <Scorecard courses={courses.data} existing={round.data} />
      )}
    </div>
  );
}
