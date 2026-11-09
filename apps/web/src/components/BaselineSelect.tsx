import { BASELINES } from '@golf-sg/shared';
import { setBaselineId, useBaselineId } from '../data/preferences';

export function BaselineSelect() {
  const baselineId = useBaselineId();
  return (
    <label className="field inline">
      <span className="sr-only">Compare against</span>
      <select
        aria-label="Compare against"
        value={baselineId}
        onChange={(e) => {
          setBaselineId(e.target.value);
        }}
      >
        {Object.values(BASELINES).map((b) => (
          <option key={b.id} value={b.id}>
            vs {b.name}
          </option>
        ))}
      </select>
    </label>
  );
}
