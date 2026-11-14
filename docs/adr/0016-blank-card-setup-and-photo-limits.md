# 16. Blank-card setup, photo limits and Qwen as the first reader

- Status: accepted
- Date: 2026-11-14

## Context

The owner wants a photo of the blank scorecard before tee-off to fill as much of the round as
possible, rather than maintaining a course directory. Golfers who use the hole-by-hole flow
shouldn't be asked for a photo at the end; golfers who only marked the card should be. Photo
reads cost money per call, so they need limits, and the owner chose a cheaper open-weight model.

## Decision

- A `layout` read returns the course name, par per hole and every tee row; the golfer picks
  their tees. The setup lives in the round like typed par and yardage (ADR 0010); there is no
  shared course list. Layout photos are not queued offline.
- The end-of-round marked-card photo is offered while any hole is blank and fills only blank
  holes.
- Photo reading needs Google sign-in and is limited to 6 per golfer per day, 40 per month and 500
  per day overall, counted in the API table with one conditional transaction before the model
  is called.
- The first model is Qwen3 VL 235B A22B (about 0.6¢ per card versus about 3¢ for Claude Sonnet).
  The reader accepts a tool call or JSON in text, and the zod schemas stay the gate.

## Consequences

- A second phone takes its own blank-card photo; past rounds still sync with their layout.
- Limits cap cost at roughly $3 a day overall, plus an AWS billing alarm as a backstop.
- Accuracy on handwriting is unproven for Qwen; photo reading stays off (`cardScanModelId`
  empty) until real cards are tested, and the model can be changed without code changes.
