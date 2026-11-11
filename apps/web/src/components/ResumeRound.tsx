import { Link } from 'react-router';
import { holesPlayed, useInProgress } from '../data/inProgress';

/** Shown on Home while a round entered hole by hole on the course hasn't been saved yet. */
export function ResumeRound() {
  const round = useInProgress();
  const played = round ? holesPlayed(round) : 0;
  if (!round || played === 0) return null;
  const toCheck = round.check?.length ?? 0;
  return (
    <section className="card resume-round" aria-label="Round in progress">
      <div>
        <p className="eyebrow">Round in progress</p>
        <strong>{round.courseName || 'Your round'}</strong>{' '}
        <span className="muted small">
          thru {played}
          {toCheck > 0 && ` · ${String(toCheck)} hole${toCheck === 1 ? '' : 's'} to check`}
        </span>
      </div>
      <Link className="button primary" to="/rounds/new">
        {toCheck > 0 || played >= round.holeCount
          ? 'Review round'
          : `Resume at hole ${String(played + 1)}`}
      </Link>
    </section>
  );
}
