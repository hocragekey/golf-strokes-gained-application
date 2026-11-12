# 15. Record where the drive finished; lay-ups count as approach

- Status: accepted (supersedes the lay-up simplification in ADR 0004)
- Date: 2026-11-12

## Context

The owner's first real round showed off-the-tee strokes gained of −4.68 for a round with good
driving. Two holes caused it: a par 5 where the drive, a lay-up and a recovery were all charged to
off the tee, and an out-of-bounds re-tee where every shot before the approach plus the penalty were
charged to the drive (−4.04 instead of about −2). The entry flow recorded only the approach
position, so nothing in between could be attributed correctly.

## Decision

- Record `driveYardsLeft` (par 4/5): yards to the pin where the drive, or the re-teed drive,
  finished. On a par 4 the app prefills the approach yards from it.
- Distinguish a penalty drop (`penalty`, ✕) from an out-of-bounds re-tee (`ob`, ✕✕). A re-tee
  counts two tee shots plus its penalty off the tee.
- Off the tee = `E(tee) − E(afterDrive) − teeShots − teePen`; lay-ups and recoveries between the
  drive and the approach count toward approach, matching the standard strokes-gained definition.
- Rounds without `driveYardsLeft` keep the old rule, so saved history doesn't change until a hole is
  edited.

## Consequences

- One more question per par 4/5 in the app (prefilled on par 4s); on the card, an extra number
  only when the approach wasn't from the drive.
- Category totals still sum to `E(tee) − score` for every hole (tested).
