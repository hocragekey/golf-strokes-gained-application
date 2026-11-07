import { Link, useNavigate, useParams } from 'react-router';
import { useDeleteRound, useRound } from '../data/hooks';
import { BaselineSelect } from '../components/BaselineSelect';
import { SgBars, SgValue } from '../components/Sg';
import { formatToPar } from '../format';

export function RoundDetail() {
  const { id } = useParams();
  const roundId = id ?? '';
  const navigate = useNavigate();
  const round = useRound(roundId);
  const remove = useDeleteRound();

  if (round.isPending) return <p className="muted">Loading…</p>;
  if (round.isError) {
    return (
      <p className="form-error" role="alert">
        {round.error.message}
      </p>
    );
  }

  const { summary, holes, round: r } = round.data;
  return (
    <div className="stack">
      <div className="card-header">
        <div>
          <h2>{summary.courseName}</h2>
          <p className="muted">
            {summary.playedOn} · {summary.score} ({formatToPar(summary.toPar)}) ·{' '}
            {summary.holesPlayed} holes{r.notes && ` · ${r.notes}`}
          </p>
        </div>
        <div className="actions">
          <Link className="button" to={`/rounds/${roundId}/edit`}>
            Edit
          </Link>
          <button
            className="danger"
            onClick={() => {
              if (!window.confirm('Delete this round?')) return;
              remove.mutate(roundId, { onSuccess: () => void navigate('/rounds') });
            }}
          >
            Delete
          </button>
        </div>
      </div>
      <section className="card">
        <div className="card-header">
          <h3>Strokes gained</h3>
          <BaselineSelect />
        </div>
        <SgBars sg={summary.sg} />
      </section>
      <section className="card">
        <h3>By hole</h3>
        <div className="table-scroll">
          <table className="table compact">
            <thead>
              <tr>
                <th>Hole</th>
                <th>Par</th>
                <th>Score</th>
                <th>OTT</th>
                <th>APP</th>
                <th>ARG</th>
                <th>PUTT</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {holes.map((h) => (
                <tr key={h.holeNumber}>
                  <td>{h.holeNumber}</td>
                  <td>{h.par}</td>
                  <td>{h.score}</td>
                  <td>
                    {h.par === 3 ? (
                      <span className="muted">—</span>
                    ) : (
                      <SgValue value={h.offTheTee} />
                    )}
                  </td>
                  <td>
                    <SgValue value={h.approach} />
                  </td>
                  <td>
                    <SgValue value={h.aroundTheGreen} />
                  </td>
                  <td>
                    <SgValue value={h.putting} />
                  </td>
                  <td>
                    <SgValue value={h.total} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
