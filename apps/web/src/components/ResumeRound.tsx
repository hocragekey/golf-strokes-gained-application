import { Link } from 'react-router';
import { holesPlayed, loadInProgress } from '../data/inProgress';

/** Shown on Home while a round entered hole by hole on the course hasn't been saved yet. */
export function ResumeRound() {
  const round = loadInProgress();
  const played = round ? holesPlayed(round) : 0;
  if (!round || played === 0) return null;
  return (
    <section className="card resume-round" aria-label="Round in progress">
      <div>
        <p className="eyebrow">Round in progress</p>
        <strong>{round.courseName || 'Your round'}</strong>{' '}
        <span className="muted small">thru {played}</span>
      </div>
      <Link className="button primary" to="/rounds/new">
        {played >= round.holeCount ? 'Finish round' : `Resume at hole ${String(played + 1)}`}
      </Link>
    </section>
  );
}
