const ROWS: [mark: string, meaning: string, example: string][] = [
  ['Score', 'Total strokes on the hole, including penalties.', '5'],
  [
    'Tee (par 4/5)',
    'Where the tee shot finished: F fairway, L left, R right, S short, P penalty/OB.',
    'L',
  ],
  [
    'App',
    'Yards to the pin for the shot into the green. Add a lie letter if not from the fairway: R rough, B bunker, T trees/recovery. Skip on par 3s.',
    '155R',
  ],
  ['GIR', 'Tick if you were on the green in regulation (par − 2 strokes).', '✓'],
  ['Miss', 'If you missed the green: L, R, Long or Short of the pin.', 'S'],
  ['SG shots', 'Number of non-putt shots from within ~50 yds (chips, pitches, bunker shots).', '1'],
  [
    'SG dist / lie',
    'Yards and lie for the first of those shots: Fr fringe, F fairway, R rough, B bunker.',
    '15B',
  ],
  ['1st putt', 'Feet from the hole for your first putt (pace it: ~3 ft per step).', '12'],
  ['Putts', 'Number of putts (0 if you holed out from off the green).', '2'],
  ['Pen', 'Penalty strokes taken on the hole.', '0'],
];

export function CardGuide() {
  return (
    <div className="stack">
      <section className="card">
        <div className="card-header">
          <h2>What to mark on your card</h2>
          <button
            className="no-print"
            onClick={() => {
              window.print();
            }}
          >
            Print
          </button>
        </div>
        <p className="muted">
          Six or so quick marks per hole give enough to split your strokes gained into off the tee,
          approach, around the green and putting. Jot them in the margin or on a sticky note on the
          back of the card.
        </p>
        <table className="table">
          <thead>
            <tr>
              <th>Mark</th>
              <th>What it means</th>
              <th>Example</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([mark, meaning, example]) => (
              <tr key={mark}>
                <td>
                  <strong>{mark}</strong>
                </td>
                <td>{meaning}</td>
                <td>
                  <code>{example}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card">
        <h2>Example hole</h2>
        <p>
          Par 4, 410 yds: <code>5 · R · 165R · ✗ S · 1 · 15B · 4 · 1 · 0</code>
        </p>
        <p className="muted">
          Drive missed right into the rough, approach from 165 yds came up short in a bunker,
          splashed out to 4 ft and holed the putt for 5.
        </p>
      </section>
    </div>
  );
}
