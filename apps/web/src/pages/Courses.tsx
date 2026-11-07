import type { Course, CourseHole } from '@golf-sg/shared';
import { courseInputSchema } from '@golf-sg/shared';
import { useState, type SubmitEvent } from 'react';
import { useCourses, useDeleteCourse, useSaveCourse } from '../data/hooks';

const defaultHoles = (count: number): CourseHole[] =>
  Array.from({ length: count }, (_, i) => ({ number: i + 1, par: 4, yardage: 380 }));

function CourseForm({ course, onDone }: { course?: Course; onDone: () => void }) {
  const save = useSaveCourse(course?.id);
  const [name, setName] = useState(course?.name ?? '');
  const [tees, setTees] = useState(course?.tees ?? '');
  const [holes, setHoles] = useState<CourseHole[]>(course?.holes ?? defaultHoles(18));
  const [error, setError] = useState<string | null>(null);

  const setHole = (i: number, patch: Partial<CourseHole>) => {
    setHoles((prev) => prev.map((h, j) => (j === i ? { ...h, ...patch } : h)));
  };

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = courseInputSchema.safeParse({ name, tees, holes });
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
      return;
    }
    try {
      await save.mutateAsync(parsed.data);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  }

  const par = holes.reduce((a, h) => a + h.par, 0);
  const yards = holes.reduce((a, h) => a + h.yardage, 0);

  return (
    <form className="stack" onSubmit={(e) => void handleSubmit(e)} noValidate>
      <div className="row">
        <label className="field">
          <span>Course name</span>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
            }}
            required
          />
        </label>
        <label className="field">
          <span>Tees</span>
          <input
            value={tees}
            onChange={(e) => {
              setTees(e.target.value);
            }}
            placeholder="White"
          />
        </label>
        <label className="field">
          <span>Holes</span>
          <select
            value={holes.length}
            onChange={(e) => {
              const n = Number(e.target.value);
              setHoles((prev) => [...prev.slice(0, n), ...defaultHoles(n).slice(prev.length)]);
            }}
          >
            <option value={18}>18</option>
            <option value={9}>9</option>
          </select>
        </label>
      </div>
      <div className="table-scroll">
        <table className="table compact">
          <thead>
            <tr>
              <th>Hole</th>
              <th>Par</th>
              <th>Yards</th>
            </tr>
          </thead>
          <tbody>
            {holes.map((h, i) => (
              <tr key={h.number}>
                <td>{h.number}</td>
                <td>
                  <select
                    aria-label={`Hole ${h.number} par`}
                    value={h.par}
                    onChange={(e) => {
                      setHole(i, { par: Number(e.target.value) });
                    }}
                  >
                    {[3, 4, 5, 6].map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    aria-label={`Hole ${h.number} yards`}
                    type="number"
                    inputMode="numeric"
                    value={h.yardage}
                    onChange={(e) => {
                      setHole(i, { yardage: Number(e.target.value) });
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th>Total</th>
              <th>{par}</th>
              <th>{yards}</th>
            </tr>
          </tfoot>
        </table>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="submit" className="primary" disabled={save.isPending}>
          {course ? 'Save course' : 'Add course'}
        </button>
        <button type="button" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function Courses() {
  const courses = useCourses();
  const remove = useDeleteCourse();
  const [editing, setEditing] = useState<Course | 'new' | null>(null);

  return (
    <div className="stack">
      <section className="card">
        <div className="card-header">
          <h2>Courses</h2>
          {editing === null && (
            <button
              className="primary"
              onClick={() => {
                setEditing('new');
              }}
            >
              Add course
            </button>
          )}
        </div>
        {editing !== null && (
          <CourseForm
            key={editing === 'new' ? 'new' : editing.id}
            course={editing === 'new' ? undefined : editing}
            onDone={() => {
              setEditing(null);
            }}
          />
        )}
        {remove.isError && (
          <p className="form-error" role="alert">
            {remove.error.message}
          </p>
        )}
        {courses.data?.length === 0 && editing === null && (
          <p className="muted">Add the course you played: par and yardage for each hole.</p>
        )}
        <ul className="list">
          {courses.data?.map((c) => (
            <li key={c.id}>
              <span>
                <strong>{c.name}</strong>{' '}
                <span className="muted small">
                  {c.tees && `${c.tees} · `}
                  {c.holes.length} holes · par {c.holes.reduce((a, h) => a + h.par, 0)}
                </span>
              </span>
              <span className="actions">
                <button
                  onClick={() => {
                    setEditing(c);
                  }}
                >
                  Edit
                </button>
                <button
                  className="danger"
                  onClick={() => {
                    if (window.confirm(`Delete ${c.name}?`)) remove.mutate(c.id);
                  }}
                >
                  Delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
