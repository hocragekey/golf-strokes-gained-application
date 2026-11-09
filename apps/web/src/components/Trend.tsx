import type { RoundSummary } from '@golf-sg/shared';
import { formatSg } from '../format';

/** Total strokes gained per round, oldest to newest, as a small line chart. */
export function Trend({ rounds }: { rounds: RoundSummary[] }) {
  if (rounds.length < 2) return <p className="muted small">Enter another round to see a trend.</p>;
  const values = rounds.map((r) => r.sg.total);
  const top = Math.max(0, ...values) + 1;
  const bottom = Math.min(0, ...values) - 1;
  const w = 300;
  const h = 80;
  const pad = 6;
  const x = (i: number) => pad + (i / (values.length - 1)) * (w - 2 * pad);
  const y = (v: number) => pad + ((top - v) / (top - bottom)) * (h - 2 * pad);
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const latest = values.at(-1) ?? 0;
  return (
    <figure className="trend">
      <svg
        viewBox={`0 0 ${String(w)} ${String(h)}`}
        role="img"
        aria-label={`Total strokes gained over your last ${String(values.length)} rounds; latest ${formatSg(latest)}`}
      >
        <line x1="0" x2={w} y1={y(0)} y2={y(0)} className="trend-zero" />
        <polyline points={points} className="trend-line" />
        {values.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r="3" className={v >= 0 ? 'sg-pos' : 'sg-neg'} />
        ))}
      </svg>
      <figcaption className="muted small">
        {rounds[0]?.playedOn} → {rounds.at(-1)?.playedOn}
      </figcaption>
    </figure>
  );
}
