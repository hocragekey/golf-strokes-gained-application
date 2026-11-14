# 14. Scorecard photo reading with Amazon Bedrock

- Status: accepted (switched off until tested on real cards)
- Date: 2026-11-07

## Context

Golfers mark the course's own scorecard in two rows (FR-CARD-01). Copying 18 holes into the app
afterwards is the slowest part of the product. The owner wants to photograph the card and have
it read automatically, including on courses with poor signal.

## Decision

- The authenticated sync API gains `POST /api/card-scan`. The browser sends one shrunk JPEG
  (long edge 2000 px, base64, under the 3.75 MB model limit); the Lambda passes it to an Amazon
  Bedrock vision model through the Converse API with a forced tool call, so the answer is
  structured JSON validated with the shared `cardScanResultSchema`.
- The model only transcribes: printed par/yardage, score, drive letter, putts and the spare-row
  text exactly as written. The shared `parseCardMarks` turns those marks into hole fields, the same
  code as typed card lines, so the AI never decides strokes-gained inputs on its own.
- Every read lands in the round in progress and opens the hole-by-hole review; holes the model
  was unsure of, or whose marks don't parse, are highlighted. Holes entered by hand are never
  overwritten.
- Photos are queued in IndexedDB when there is no signal and read on reconnect; they are deleted
  once read and never stored or logged on the server.
- The feature is off unless `config/app.json` sets `cardScanModelId` (a Bedrock model or
  inference-profile ID). The same value switches the button on in the web build and grants the
  Lambda `bedrock:InvokeModel`. It needs Google sign-in, so the endpoint can't be used anonymously.
- Bedrock over Amazon Textract: Textract reads printed grids and digits well but not arrows or
  handwritten lie letters, and would need custom layout logic per card.

## Consequences

- Roughly 1-3 cents per photo (model dependent); stage throttling bounds abuse. A per-user quota
  comes with paid tiers.
- The owner must enable access to the chosen model in the Bedrock console once per account.
- Accuracy is unproven until tested on real marked cards; that test decides the model and whether
  the feature is switched on.
