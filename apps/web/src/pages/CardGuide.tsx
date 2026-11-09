import { QrCode } from '../components/QrCode';

/** One line per hole, always in this order, so it fits any scorecard or a scrap of paper. */
const NOTATION: [field: string, write: string, when: string, example: string][] = [
  ['Score', 'Strokes on the hole, penalties included.', 'Every hole', '5'],
  [
    'Tee',
    'Where the drive finished: F fairway, L left, R right, S short, P penalty/OB.',
    'Par 4s and 5s',
    'R',
  ],
  [
    'Approach',
    'Yards to the pin for the shot into the green, plus a lie letter if not from the fairway: r rough, s sand, t trees/recovery.',
    'Par 4s and 5s (par 3s use the card yardage)',
    '165r',
  ],
  [
    'Green',
    '✓ if on in regulation, otherwise where you missed: L, R, Lg long, Sh short.',
    'Every hole',
    'Sh',
  ],
  [
    'Short game',
    'Number of chips/pitches/bunker shots inside ~50 yds @ yards of the first one, plus its lie: f fringe, r rough, s sand (none = fairway).',
    'Only if you hit any',
    '1@15s',
  ],
  [
    '1st putt',
    'Number of putts @ feet for the first putt (pace it off: about 3 ft per step). 0 if you holed out from off the green.',
    'Every hole',
    '1@4',
  ],
  ['Penalties', 'Penalty strokes, written with a plus sign.', 'Only if any', '+1'],
];

const EXAMPLES: [hole: string, line: string, story: string][] = [
  [
    'Par 4, 410 yds',
    '5 R 165r Sh 1@15s 1@4',
    'Drive right into the rough, 165 yds approach short into a bunker, splash to 4 ft, one putt.',
  ],
  ['Par 3, 160 yds', '3 ✓ 2@25', 'Green in regulation from the tee, two-putt from 25 ft.'],
  [
    'Par 5, 520 yds',
    '6 P 90 ✓ 2@30 +1',
    'Drive out of bounds (+1), wedge from 90 yds onto the green, two-putt from 30 ft.',
  ],
];

const SHEET_COLUMNS = [
  'Hole',
  'Par',
  'Score',
  'Tee',
  'Approach',
  'Green',
  'Short game',
  'Putts',
  'Pen',
];

export function CardGuide() {
  const guideUrl = new URL(`${import.meta.env.BASE_URL}guide`, window.location.origin).href;
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
        <p>
          Write <strong>one short line per hole</strong>, always in the same order. It works on any
          scorecard: put the score in the normal box and the rest in a spare player row, the margin,
          the back of the card, or the pocket sheet below. Skip anything that didn&apos;t happen.
        </p>
        <p className="notation-pattern">
          <code>Score · Tee · Approach · Green · Short game · Putts · Penalties</code>
        </p>
        <table className="table">
          <thead>
            <tr>
              <th>Field</th>
              <th>What to write</th>
              <th>When</th>
              <th>Example</th>
            </tr>
          </thead>
          <tbody>
            {NOTATION.map(([field, write, when, example]) => (
              <tr key={field}>
                <td>
                  <strong>{field}</strong>
                </td>
                <td>{write}</td>
                <td className="muted small">{when}</td>
                <td>
                  <code>{example}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>Examples</h2>
        <table className="table">
          <tbody>
            {EXAMPLES.map(([hole, line, story]) => (
              <tr key={hole}>
                <td className="nowrap">{hole}</td>
                <td>
                  <code>{line}</code>
                </td>
                <td className="muted">{story}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card pocket-sheet" aria-labelledby="pocket-sheet-title">
        <div className="card-header">
          <div>
            <h2 id="pocket-sheet-title">Pocket stat sheet</h2>
            <p className="muted small">
              Print this if the course card has no room. Scan the code on the course for this guide.
            </p>
          </div>
          <figure className="qr">
            <QrCode value={guideUrl} label="QR code linking to the card guide" />
            <figcaption className="small muted">Card guide</figcaption>
          </figure>
        </div>
        <p className="small">
          <code>Tee</code> F L R S P · <code>Approach</code> yds + r s t · <code>Green</code> ✓ L R
          Lg Sh · <code>Short game</code> n@yds + f r s · <code>Putts</code> n@ft
        </p>
        <table className="table sheet">
          <thead>
            <tr>
              {SHEET_COLUMNS.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 18 }, (_, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                {SHEET_COLUMNS.slice(1).map((c) => (
                  <td key={c} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
