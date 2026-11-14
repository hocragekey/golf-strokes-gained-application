import { QrCode } from '../components/QrCode';

/** Marks in your own score row: the score as usual plus two small corner marks. */
const SCORE_ROW: [mark: string, write: string, when: string][] = [
  ['Score', 'In the middle of the box, as usual. Penalty strokes included.', 'Every hole'],
  [
    'Drive',
    'Top-left corner: ↑ fairway, ← missed left, → missed right, ↓ short or topped, ✕ penalty.',
    'Par 4s and 5s',
  ],
  ['Putts', 'Bottom-right corner: count only putts from on the green.', 'Every hole'],
  [
    'Missed side',
    'Optional: a dot on the side of the box where you missed the green.',
    'If missed',
  ],
];

/** The spare row underneath: approach yards / chip / first-putt feet. */
const EXAMPLES: [card: string, story: string][] = [
  ['140 / 30', 'Approach from 140 yds onto the green, first putt from 30 ft.'],
  ['175 / s15 / 8', 'Approach from 175 yds, bunker shot from 15 yds, first putt from 8 ft.'],
  ['190 / r25', 'Chipped in from 25 yds in the rough, so no putts.'],
  ['s10 / 5', 'Par 3: the tee shot is the approach, so no yards. Bunker shot, 5 ft putt.'],
];

export function CardGuide() {
  const base = import.meta.env.BASE_URL;
  const guideUrl = new URL(`${base}guide`, window.location.origin).href;
  return (
    <div className="stack">
      <section className="card">
        <h2>How to mark your scorecard</h2>
        <p>
          Use the card from the course: your <strong>normal row</strong> plus{' '}
          <strong>one spare row</strong> underneath. Nothing to print.
        </p>
        <div className="card-diagram">
          <a href={`${base}card-marking.svg`} target="_blank" rel="noreferrer">
            <img
              src={`${base}card-marking.svg`}
              alt="Example front nine marked with drive arrows, putts in the corner and approach / chip / putt numbers in the spare row"
              width={1590}
              height={1010}
            />
          </a>
        </div>
        <p className="muted small">Swipe sideways or tap the card to see it full size.</p>
      </section>

      <section className="card">
        <h2>1. Your row: the score box</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Mark</th>
              <th>What to write</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {SCORE_ROW.map(([mark, write, when]) => (
              <tr key={mark}>
                <td>
                  <strong>{mark}</strong>
                </td>
                <td>{write}</td>
                <td className="muted small">{when}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>2. Spare row: the numbers</h2>
        <p className="notation-pattern">
          <code>approach yards / chip / first putt feet</code>
        </p>
        <p className="muted">
          Chip: a lie letter (<code>r</code> rough, <code>s</code> sand, <code>f</code> fairway or
          fringe) and the yards to the pin; paces are fine. Leave it out if you hit the green. Add{' '}
          <code>s</code> to the approach (<code>165s</code>) if it was from a bunker.
        </p>
        <table className="table">
          <tbody>
            {EXAMPLES.map(([card, story]) => (
              <tr key={card}>
                <td className="nowrap">
                  <code>{card}</code>
                </td>
                <td className="muted">{story}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>3. The app works out the rest</h2>
        <ul>
          <li>Green in regulation: score minus putts is at most par minus 2.</li>
          <li>Number of chips: from the score, putts and shots to reach the green.</li>
          <li>Approach lie: a drive missed left or right means the approach was from the rough.</li>
          <li>Penalty: a ✕ drive counts one penalty stroke.</li>
        </ul>
      </section>

      <section className="card share-guide">
        <figure className="qr">
          <QrCode value={guideUrl} label="QR code linking to the card guide" />
          <figcaption>
            <strong>Scan to open this guide</strong>
            <span className="muted small"> No account needed.</span>
          </figcaption>
        </figure>
      </section>
    </div>
  );
}
