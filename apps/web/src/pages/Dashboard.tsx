import { CATEGORY_LABELS, type BucketStat } from '@golf-sg/shared';
import { useState } from 'react';
import { useStats } from '../data/hooks';
import { BaselineSelect } from '../components/BaselineSelect';
import { Hero, HowItWorks } from '../components/Hero';
import { PracticeFirst } from '../components/Practice';
import { Trend } from '../components/Trend';
import { SgBars, SgValue } from '../components/Sg';
import { formatNumber, formatPct } from '../format';

const RANGES = [
  { label: 'Last 5 rounds', value: 5 },
  { label: 'Last 20 rounds', value: 20 },
  { label: 'All rounds', value: 0 },
];

function BucketTable({
  title,
  buckets,
  unit,
}: {
  title: string;
  buckets: BucketStat[];
  unit: string;
}) {
  return (
    <section className="card">
      <h3>{title}</h3>
      {buckets.length === 0 ? (
        <p className="muted">No data yet.</p>
      ) : (
        <table className="table compact">
          <thead>
            <tr>
              <th>Range</th>
              <th>Count</th>
              <th>SG {unit}</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <tr key={b.label}>
                <td>{b.label}</td>
                <td>{b.count}</td>
                <td>{b.count === 0 ? '—' : <SgValue value={b.sgPerShot} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export function Dashboard() {
  const [limit, setLimit] = useState(20);
  const stats = useStats(limit || undefined);

  if (stats.isPending) return <p className="muted">Loading…</p>;
  if (stats.isError) {
    return (
      <p className="form-error" role="alert">
        Failed to load stats: {stats.error.message}
      </p>
    );
  }

  const s = stats.data;
  if (s.rounds === 0) {
    return (
      <div className="stack">
        <Hero />
        <HowItWorks />
      </div>
    );
  }

  const top = s.priorities[0];
  const t = s.traditional;
  return (
    <div className="stack">
      <Hero compact />
      <div className="card-header">
        <h2>
          Strokes gained per 18 <span className="muted small">vs {s.baseline} baseline</span>
        </h2>
        <div className="actions">
          <BaselineSelect />
          <label className="field inline">
            <span className="sr-only">Range</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
              }}
            >
              {RANGES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="grid-2">
        <div className="stack">
          {top && (
            <PracticeFirst
              category={top.category}
              value={top.sgPer18}
              focus={top.focus}
              per="per 18"
            />
          )}
          <section className="card">
            <h3>Practice priorities</h3>
            <ol className="priorities">
              {s.priorities.map((p) => (
                <li key={p.category}>
                  <strong>{CATEGORY_LABELS[p.category]}</strong> <SgValue value={p.sgPer18} />
                  <div className="muted small">{p.focus}</div>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <section className="card">
          <h3>
            {s.rounds} round{s.rounds === 1 ? '' : 's'}, {s.holes} holes
          </h3>
          <SgBars sg={s.sgPer18} />
          <h4>Trend</h4>
          <Trend rounds={s.trend} />
        </section>
      </div>
      <section className="card">
        <h3>Traditional stats (per 18)</h3>
        <dl className="stats">
          <div>
            <dt>Scoring avg</dt>
            <dd>{formatNumber(t.scoringAverage)}</dd>
          </div>
          <div>
            <dt>Fairways</dt>
            <dd>{formatPct(t.fairwayPct)}</dd>
          </div>
          <div>
            <dt>Miss L / R</dt>
            <dd>
              {formatPct(t.missLeftPct)} / {formatPct(t.missRightPct)}
            </dd>
          </div>
          <div>
            <dt>GIR</dt>
            <dd>{formatPct(t.girPct)}</dd>
          </div>
          <div>
            <dt>Putts</dt>
            <dd>{formatNumber(t.puttsPer18)}</dd>
          </div>
          <div>
            <dt>Up &amp; down</dt>
            <dd>{formatPct(t.upAndDownPct)}</dd>
          </div>
        </dl>
        <p className="muted small">
          Green misses: left {s.approachMisses.left}, right {s.approachMisses.right}, long{' '}
          {s.approachMisses.long}, short {s.approachMisses.short}
        </p>
      </section>
      <div className="grid-3">
        <BucketTable title="Approach by distance" buckets={s.approachByDistance} unit="/ shot" />
        <BucketTable
          title="Around the green by lie"
          buckets={s.aroundTheGreenByLie}
          unit="/ hole"
        />
        <BucketTable
          title="Putting by first-putt distance"
          buckets={s.puttingByDistance}
          unit="/ hole"
        />
      </div>
    </div>
  );
}
