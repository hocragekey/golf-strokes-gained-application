# 10. Rounds own their hole layout; courses are optional shortcuts

- Status: Accepted
- Date: 2026-11-09

## Context

Golfers mark a physical scorecard and enter the round afterwards. Requiring them to create and
select a course first (PRD v1.2, FR-COURSE-01, FR-ENTRY-01) was the biggest point of friction in
the owner's UX review. The SG engine still needs each hole's par and yardage, but both are printed
on every scorecard, so they can be copied during entry like the other marks.

Rounds referenced a course by `courseId`, which also meant editing a course could invalidate saved
rounds (hence the old FR-COURSE-02/03 locks).

## Decision

- A round stores `courseName`, `tees` and `layout[]` (`{ number, par, yardage }` per played hole).
  Validation, SG and stats use `round.layout`; `courseId` is removed.
- The `courses` table stays, as saved layouts. `saveRound` upserts one (matched by name + tees,
  case-insensitive) whenever the round has a course name, and entry pre-fills par and yardage from
  it. Courses can be edited or deleted without affecting any round.
- Dexie version 2 migrates existing rounds by copying their course into the round; backup format
  version 2 carries the new shape and version 1 files are upgraded on import.

## Consequences

- New rounds need no setup; the PRD's journeys and FR-ENTRY/FR-COURSE requirements were rewritten
  (PRD 1.3).
- Par/yardage is duplicated per round. That is intentional: a round is a historical record of the
  card that was played, tees and course changes don't rewrite history, and each round syncs as one
  self-contained document in Phase 2.
- A shared course library (FR-COURSE-04) slots in as another source for pre-fill.
