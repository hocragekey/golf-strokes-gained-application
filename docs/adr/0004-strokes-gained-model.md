# 4. Strokes-gained model from scorecard marks

- Status: Accepted
- Date: 2026-11-07

## Context

Full shot-by-shot tracking is accurate but tedious. We want useful category SG from about six
marks per hole written on a paper card.

## Decision

Per hole we record: score, tee result (par 4/5), approach distance and lie, GIR, miss direction,
short-game shot count with first distance and lie, first-putt distance, putts and penalties.
For each shot, `SG = E(start) - E(end) - strokes`, using expected-strokes tables by lie and
distance (green in feet, elsewhere in yards). Categories:

- **Off the tee**: tee to the approach position on par 4/5. Lay-ups and recovery shots before
  the recorded approach on par 5s are folded in (v1 simplification). Tee penalties count here.
- **Approach**: approach position (or par-3 tee) to the first short-game or putt position.
  Other penalties count here.
- **Around the green**: first short-game position to the first putt.
- **Putting**: first-putt distance to holed.

The four categories sum to `E(tee) - score` for every hole, which is enforced by tests.

The default baseline is the PGA Tour table adapted from Mark Broadie's _Every Shot Counts_.
The `Baseline` interface allows additional baselines (scratch, handicap-matched) to be added and
selected without changing the engine.

## Consequences

- SG values are relative to tour level and will be negative for most amateurs; the ranking of
  categories, not the absolute number, drives practice priorities.
- Missing intermediate shots on long holes reduce OTT/approach precision; shot-by-shot entry can
  be layered on later without changing the category definitions.
