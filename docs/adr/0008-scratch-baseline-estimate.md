# 8. Estimated scratch baseline by scaling the Tour tables

- Status: Accepted
- Date: 2026-11-07

## Context

Strokes gained against the PGA Tour is negative in every category for most amateurs. A closer
reference point makes the numbers more meaningful (PRD FR-SG-07). Published expected-strokes tables
for scratch or handicap levels are not yet sourced or licensed (PRD Q1).

## Decision

Add a `scratch` baseline derived from the Tour baseline with `scaledBaseline`:

`E'(d, lie) = E(d, lie) + 0.06 · max(0, E(d, lie) − 1)`

- Holed balls stay at 0 and tap-ins at 1, and the curve stays monotonic in distance.
- The factor makes scratch about 3 strokes per 18 holes weaker than the Tour on a typical par-72
  course, consistent with the commonly cited gap between scratch amateurs and Tour players.
- It is labelled "Scratch (est.)" in the UI. The PGA Tour baseline stays the default.
- The selection is a per-device preference; `getBaseline` falls back to the default for unknown ids.

## Consequences

- The engine is unchanged; the category-sum invariant is tested for every registered baseline.
- Uniform scaling is a rough approximation: real amateur gaps differ by category (e.g. larger in
  approach than putting). Sourced handicap-matched tables (FR-SG-08) will replace this baseline
  while keeping its id so saved preferences stay valid.
