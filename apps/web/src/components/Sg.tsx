import { CATEGORY_LABELS, type CategoryKey, type SgCategories } from '@golf-sg/shared';
import { formatSg, sgClass } from '../format';

export function SgValue({ value }: { value: number }) {
  return <span className={sgClass(value)}>{formatSg(value)}</span>;
}

const KEYS = Object.keys(CATEGORY_LABELS) as CategoryKey[];

/** Horizontal diverging bars, one per strokes-gained category. */
export function SgBars({ sg }: { sg: SgCategories }) {
  const scale = Math.max(1, ...KEYS.map((k) => Math.abs(sg[k])));
  return (
    <ul className="sg-bars" aria-label="Strokes gained by category">
      {KEYS.map((key) => {
        const value = sg[key];
        const width = `${(Math.abs(value) / scale) * 50}%`;
        return (
          <li key={key}>
            <span className="sg-label">{CATEGORY_LABELS[key]}</span>
            <span className="sg-track" aria-hidden="true">
              <span
                className={`sg-fill ${sgClass(value)}`}
                style={
                  value < 0
                    ? { right: '50%', width, transformOrigin: 'right' }
                    : { left: '50%', width, transformOrigin: 'left' }
                }
              />
            </span>
            <SgValue value={value} />
          </li>
        );
      })}
      <li className="sg-total">
        <span className="sg-label">Total</span>
        <span />
        <SgValue value={sg.total} />
      </li>
    </ul>
  );
}
