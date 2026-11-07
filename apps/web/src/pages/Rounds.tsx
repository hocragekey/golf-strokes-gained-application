import { Link } from 'react-router';
import { useRounds } from '../data/hooks';
import { SgValue } from '../components/Sg';
import { formatToPar } from '../format';

export function Rounds() {
  const rounds = useRounds();
  return (
    <section className="card">
      <div className="card-header">
        <h2>Rounds</h2>
        <Link className="button primary" to="/rounds/new">
          Enter round
        </Link>
      </div>
      {rounds.isPending && <p className="muted">Loading…</p>}
      {rounds.isError && (
        <p className="form-error" role="alert">
          {rounds.error.message}
        </p>
      )}
      {rounds.data?.length === 0 && <p className="muted">No rounds yet.</p>}
      {rounds.data && rounds.data.length > 0 && (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Course</th>
                <th>Score</th>
                <th>OTT</th>
                <th>APP</th>
                <th>ARG</th>
                <th>PUTT</th>
                <th>Total SG</th>
              </tr>
            </thead>
            <tbody>
              {rounds.data.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link to={`/rounds/${r.id}`}>{r.playedOn}</Link>
                  </td>
                  <td>
                    {r.courseName}
                    {r.holesPlayed !== 18 && (
                      <span className="muted small"> ({r.holesPlayed} holes)</span>
                    )}
                  </td>
                  <td>
                    {r.score} ({formatToPar(r.toPar)})
                  </td>
                  <td>
                    <SgValue value={r.sg.offTheTee} />
                  </td>
                  <td>
                    <SgValue value={r.sg.approach} />
                  </td>
                  <td>
                    <SgValue value={r.sg.aroundTheGreen} />
                  </td>
                  <td>
                    <SgValue value={r.sg.putting} />
                  </td>
                  <td>
                    <SgValue value={r.sg.total} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
