import type { CSSProperties } from 'react';
import { Link } from 'react-router';

const base = import.meta.env.BASE_URL;
const heroImage = {
  '--hero-image': `image-set(url('${base}hero-course-800.webp') 1x, url('${base}hero-course.webp') 2x)`,
  '--hero-image-wide': `url('${base}hero-course.webp')`,
} as CSSProperties;

/** Full-bleed course photo with the product promise and the two ways to get started. */
export function Hero({ compact = false }: { compact?: boolean }) {
  return (
    <section className={`hero${compact ? ' compact' : ''}`} style={heroImage}>
      <div className="hero-inner">
        <p className="eyebrow">Strokes gained from any scorecard</p>
        <h1>Improve your golf game</h1>
        {!compact && (
          <p className="hero-lede">
            Mark a few numbers on your card as you play. Afterwards, answer a few quick questions
            per hole and see exactly where you&apos;re losing strokes and what to practise.
          </p>
        )}
        <div className="hero-actions">
          <Link className="button primary big" to="/rounds/new">
            Enter a round
          </Link>
          <Link className="button ghost big" to="/guide">
            Get the card guide &amp; QR code
          </Link>
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  {
    title: 'Before you play',
    text: 'Print the pocket sheet or scan its QR code. It shows what to jot down on any scorecard.',
  },
  {
    title: 'On the course',
    text: 'Mark score, drive, approach distance, chips and putts. About five seconds a hole.',
  },
  {
    title: 'After the round',
    text: 'We ask one question at a time, hole by hole. No course setup.',
  },
];

export function HowItWorks() {
  return (
    <ol className="how-it-works" aria-label="How it works">
      {STEPS.map((s, i) => (
        <li key={s.title} className="card">
          <span className="step-num">{i + 1}</span>
          <h3>{s.title}</h3>
          <p className="muted">{s.text}</p>
        </li>
      ))}
    </ol>
  );
}
