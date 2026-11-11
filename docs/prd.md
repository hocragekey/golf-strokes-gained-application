# Product Requirements Document: Golf Strokes Gained

| Field   | Value                                                                                |
| ------- | ------------------------------------------------------------------------------------ |
| Status  | v1 implemented (Phase 1); Phases 2–5 proposed                                        |
| Owner   | @hocragekey                                                                          |
| Version | 1.5, saved courses and backup import removed (see §11)                               |
| Related | [Technical design](technical-design.md) · [ADRs](adr) · [AWS runbook](deploy-aws.md) |

This PRD is the source of truth for **what** the product does and **why**. The
[technical design](technical-design.md) describes **how**, and refers back to the requirement IDs
below (`FR-*`, `NFR-*`). Every change to behavior updates this document in the same PR.

## 1. Problem

Amateur golfers practice what feels bad, not what costs them strokes. Strokes gained (SG) is the
best-known way to find where strokes are lost, but today it means either shot-tracking hardware
and subscriptions (Arccos, Shot Scope), tedious shot-by-shot apps on the course, or spreadsheets.

Most golfers already carry a paper scorecard. The gap is a **lightweight way to capture just
enough on that card** to compute SG by category, and a tool that turns it into a practice plan.

## 2. Goals and non-goals

### Goals (Phase 1)

- G1. Capture enough per hole, in a few seconds, on **any** scorecard, to compute SG for off the
  tee, approach, around the green and putting.
- G2. Turn a round into SG by category and a ranked "practice this next" list in under two minutes
  of typing after the round.
- G3. Work fully offline on a phone or laptop; no account, no network, no data leaving the device.
- G4. Be accurate and transparent about the model: same input, same numbers, on every platform.
- G5. Be a foundation for accounts, sync, native apps, and paid tiers without a rewrite.

### Non-goals (Phase 1)

- Shot-by-shot tracking, GPS, club tracking, or on-course entry workflows.
- Accounts, sync, sharing, or social features.
- Handicap index calculation (WHS) or official score posting.
- Native mobile apps (planned, Phase 3).

## 3. Users and personas

| Persona               | Description                                        | Primary need                              |
| --------------------- | -------------------------------------------------- | ----------------------------------------- |
| **Improving amateur** | 5–20 handicap, plays weekly, practices with intent | Know what to practice; see it improve     |
| **Data-curious low**  | 0–5 handicap, already tracks fairways/GIR/putts    | Real SG without hardware                  |
| **Buddy group**       | A few friends using the same hosted app            | Easy to share a link; each keeps own data |
| _Coach (Phase 4)_     | Teaching pro with a roster of students             | See students' SG to plan lessons          |

## 4. User journeys

1. **Before the round:** open the card guide (or scan the QR on the pocket sheet), learn the
   one-line notation, optionally print the pocket sheet.
2. **On the course:** write one short line per hole on the scorecard or sheet.
3. **After the round:** tap **Enter a round**. No course setup: optionally name the course, then
   answer one question at a time per hole (par and yardage from the card, score, drive, approach,
   green, short game, putts, penalties), or type the hole's card line as a shortcut. See SG for the
   round and the one thing to practise first.
4. **Over time:** watch per-18 SG trends and practice priorities over the last 5, 20, or all rounds;
   compare against a Tour or scratch baseline.
5. **Safety net:** export a JSON backup; restore it on another device or browser.

## 5. Functional requirements

Priority uses MoSCoW. Status: ✅ implemented · ◐ partial · 🚧 in progress · 🔜 planned (phase in brackets).

### 5.1 Card capture (scorecard-agnostic)

| ID         | Requirement                                                                                                                                                                                                           | Priority | Status |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| FR-CARD-01 | The app defines a **one-line-per-hole notation** in a fixed order (`Score · Drive · Approach · Green · Short game · Putts · Penalties`) that fits in a single scorecard column, spare row, margin, or scrap of paper. | Must     | ✅     |
| FR-CARD-02 | The card guide explains every field, when it applies (e.g. tee result only on par 4/5), and shows worked examples for a par 3, 4 and 5.                                                                               | Must     | ✅     |
| FR-CARD-03 | A **printable pocket stat sheet** (18 rows, one column per field, with a notation legend) for courses whose card has no room.                                                                                         | Must     | ✅     |
| FR-CARD-04 | The pocket sheet carries a **QR code** to the card guide of the environment it was printed from, generated on-device (works offline).                                                                                 | Should   | ✅     |
| FR-CARD-05 | The notation captures exactly the fields the SG engine needs (FR-ENTRY-02), nothing more.                                                                                                                             | Must     | ✅     |

### 5.2 Course data

Rounds never require a course. A round stores the par and yardage of every hole it played, copied
from the physical scorecard during entry. Saved courses were removed in 1.5; pre-filled par and
yardage will come from a course data integration (FR-COURSE-04).

| ID           | Requirement                                                                                       | Priority | Status     |
| ------------ | ------------------------------------------------------------------------------------------------- | -------- | ---------- |
| FR-COURSE-01 | ~~Remember a course from a named round.~~ Removed in 1.5 (owner): replaced by FR-COURSE-04.       | —        | ❌ Removed |
| FR-COURSE-02 | Rounds never depend on course data: every round keeps its own par and yardage (ADR 0010).         | Must     | ✅         |
| FR-COURSE-03 | ~~Pre-fill from a saved course.~~ Removed in 1.5 (owner): replaced by FR-COURSE-04.               | —        | ❌ Removed |
| FR-COURSE-04 | Course data integration (third-party course database) that pre-fills hole count, par and yardage. | Could    | 🔜 (P2)    |

### 5.3 Round entry

| ID          | Requirement                                                                                                                                                                                                                                                                                                                        | Priority | Status |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| FR-ENTRY-01 | Start a round with no setup: date (today, local time), optional course name and tees, 9 or 18 holes, optional notes. Par (3–6) and yardage (50–800) are entered per hole from the card and stored with the round. 1–18 holes, consecutive from hole 1.                                                                             | Must     | ✅     |
| FR-ENTRY-02 | Per hole: score, tee result (par 4/5), approach yards and lie (par 4/5), GIR, miss direction, short-game shot count + first distance and lie, putts + first-putt feet, penalties.                                                                                                                                                  | Must     | ✅     |
| FR-ENTRY-03 | Cross-field validation with field-level messages (e.g. GIR impossible for the score, first-putt distance required when putts > 0, score too low for the shots recorded).                                                                                                                                                           | Must     | ✅     |
| FR-ENTRY-04 | Edit and delete saved rounds.                                                                                                                                                                                                                                                                                                      | Must     | ✅     |
| FR-ENTRY-05 | Guided entry that just asks: one question per screen with large tap targets; single-choice answers advance automatically; questions that don't apply are skipped (no drive or approach distance on par 3s). Each hole ends with a summary (card line + issues with a Fix link); any hole can be revisited; running score is shown. | Must     | ✅     |
| FR-ENTRY-06 | Optional shortcut: type a hole's one-line card notation (e.g. `5 R 165r Sh 1@15s 1@4`) to fill every answer; parse errors say what is missing. Never required.                                                                                                                                                                     | Should   | ✅     |
| FR-ENTRY-07 | Existing on-device rounds keep working: the database upgrade gives each round a copy of its course's par, yardage, name and tees.                                                                                                                                                                                                  | Must     | ✅     |

### 5.3.1 Home and results

| ID         | Requirement                                                                                                                                                                    | Priority | Status |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------ |
| FR-HOME-01 | Home leads with a full-bleed golf course photo, the promise ("Improve your golf game") and two actions: **Enter a round** and **Get the card guide & QR code**. Works offline. | Must     | ✅     |
| FR-HOME-02 | With no rounds yet, home explains the three steps (before, during, after the round).                                                                                           | Must     | ✅     |
| FR-HOME-03 | Dashboard and round results lead with **Practice this first**: the weakest category, its SG, and one concrete drill. Round results also show the best and toughest hole.       | Must     | ✅     |
| FR-HOME-04 | Dashboard shows a total-SG trend across the selected rounds.                                                                                                                   | Should   | ✅     |
| FR-HOME-05 | On phones, navigation is a bottom tab bar (Home, Rounds, New round, Card guide, My data).                                                                                      | Should   | ✅     |

### 5.4 Strokes gained and insights

| ID       | Requirement                                                                                                                                         | Priority | Status  |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| FR-SG-01 | Compute SG per hole and per round for off the tee, approach, around the green and putting; categories sum to E(tee) − score.                        | Must     | ✅      |
| FR-SG-02 | Aggregate per-18 SG across the last 5, 20, or all rounds.                                                                                           | Must     | ✅      |
| FR-SG-03 | Breakdowns: approach SG by distance band, short-game SG by lie, putting SG by first-putt band, approach miss directions.                            | Must     | ✅      |
| FR-SG-04 | Traditional stats: scoring average, fairway %, miss left/right %, GIR %, putts per 18, up-and-down %.                                               | Must     | ✅      |
| FR-SG-05 | Ranked practice priorities with a concrete focus line per category, only citing ranges with ≥ 3 samples.                                            | Must     | ✅      |
| FR-SG-06 | Round-by-round SG trend.                                                                                                                            | Must     | ✅      |
| FR-SG-07 | **Selectable baseline**: PGA Tour (default) or scratch (estimated); a per-device preference applied to the dashboard, rounds list and round detail. | Should   | ✅      |
| FR-SG-08 | Handicap-matched baselines (e.g. 5, 10, 15, 20) from sourced data.                                                                                  | Should   | 🔜 (P2) |
| FR-SG-09 | Drill library mapped to each practice priority.                                                                                                     | Could    | 🔜 (P2) |

### 5.5 Data ownership

| ID         | Requirement                                                                                                 | Priority | Status     |
| ---------- | ----------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| FR-DATA-01 | All rounds are stored on the device. Nothing leaves it unless the golfer signs in (FR-ACCT-01).             | Must     | ✅         |
| FR-DATA-02 | "Download my data": export everything on the device as a versioned JSON file.                               | Must     | ✅         |
| FR-DATA-03 | ~~Import a backup file.~~ Removed in 1.5 (owner): signing in (FR-SYNC-01..03) moves rounds between devices. | —        | ❌ Removed |
| FR-DATA-04 | Request persistent storage so the browser does not evict data under pressure.                               | Must     | ✅         |
| FR-DATA-05 | CSV export of rounds and hole data for spreadsheets.                                                        | Could    | 🔜 (P2)    |

### 5.6 Offline and install

| ID        | Requirement                                                                                     | Priority | Status |
| --------- | ----------------------------------------------------------------------------------------------- | -------- | ------ |
| FR-PWA-01 | After the first visit the app loads and works with no network, including previously saved data. | Must     | ✅     |
| FR-PWA-02 | Installable to the home screen (web manifest, icons, standalone display).                       | Must     | ✅     |
| FR-PWA-03 | Visible offline indicator that reassures rather than warns.                                     | Should   | ✅     |
| FR-PWA-04 | New releases reach installed clients on next launch without manual cache clearing.              | Must     | ✅     |

### 5.7 Accounts and sync

Signing in is optional. Signed out, the app behaves exactly as in Phase 1. Signed in, the device
keeps its own full copy and syncs in the background, so entering a round on the course never waits
for the network.

| ID         | Requirement                                                                                                                                                                                        | Priority  | Status  |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------- |
| FR-ACCT-01 | **Sign in with Google** from the Account page. No passwords, no separate sign-up step; the Google account is the identity.                                                                         | Must      | 🚧      |
| FR-ACCT-02 | The Account page shows who is signed in, sync status and a sign-out button. The navigation shows the signed-in state.                                                                              | Must      | 🚧      |
| FR-ACCT-03 | Signing out asks whether to also remove the rounds from this device (default yes, since they are safe in the account), so a shared phone does not leak one golfer's rounds into another's account. | Must      | 🚧      |
| FR-ACCT-04 | **Delete my account data** permanently removes every round and course stored for the account on the server, after confirmation.                                                                    | Must      | 🚧      |
| FR-ACCT-05 | Account features are hidden when the build has no Google client configured; the rest of the app is unaffected.                                                                                     | Must      | 🚧      |
| FR-ACCT-06 | Native iOS (Phase 3) also offers **Sign in with Apple** (App Store guideline 4.8) and maps it to the same account model.                                                                           | Must (P3) | 🔜 (P3) |
| FR-SYNC-01 | The first sign-in on a device uploads the rounds and courses already on it.                                                                                                                        | Must      | 🚧      |
| FR-SYNC-02 | Rounds saved, edited or deleted while offline queue on the device and upload automatically when the connection returns.                                                                            | Must      | 🚧      |
| FR-SYNC-03 | Changes from the golfer's other devices download on sign-in, on reconnect, when the app regains focus and on "Sync now".                                                                           | Must      | 🚧      |
| FR-SYNC-04 | If the same round changes on two devices, the most recent edit wins; deletes sync as well and are never resurrected by a stale device.                                                             | Must      | 🚧      |
| FR-SYNC-05 | A sync status line: "Synced 2 min ago", "3 changes waiting", "Offline, will sync later", "Sign in again to sync". Failures never block local use.                                                  | Must      | 🚧      |
| FR-SYNC-06 | **Progress across devices**: the dashboard, trend and practice priorities use every round in the account once synced.                                                                              | Must      | 🚧      |

## 6. Non-functional requirements

| ID          | Requirement                                                                                                                        | Status  |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------- |
| NFR-PERF-01 | Stats for 100 rounds compute in < 100 ms on a mid-range phone; first load of the app shell < 200 KB gzipped JS.                    | ✅      |
| NFR-PRIV-01 | No analytics, trackers, or third-party requests in Phase 1. CSP restricts all fetches to the app's own origin.                     | ✅      |
| NFR-SEC-01  | Hosting: private origin, HTTPS only, HSTS, CSP, frame-ancestors none; CI deploys via short-lived OIDC credentials, no stored keys. | ✅      |
| NFR-SEC-02  | Supply chain: SHA-pinned actions, dependency review, secret scanning, CodeQL, SBOM + provenance + keyless signing on images.       | ✅      |
| NFR-SEC-03  | Any server-side data API requires authentication and per-user authorization before it is exposed publicly.                         | 🔜 (P2) |
| NFR-A11Y-01 | WCAG 2.1 AA target: labelled controls, keyboard operable, sufficient contrast, errors announced. No formal audit yet.              | ◐       |
| NFR-UX-01   | Desktop-first layout (~1160 px centered) that remains usable down to a 360 px phone; printable guide and sheet.                    | ✅      |
| NFR-PORT-01 | The SG engine is framework-free TypeScript usable unchanged by web, server, and native clients.                                    | ✅      |
| NFR-QUAL-01 | Every PR passes format, lint (zero warnings), typecheck, unit/component tests with coverage thresholds, build, E2E incl. offline.  | ✅      |
| NFR-OPS-01  | Separate dev and prod environments; prod deploys require approval; rollback is a re-run of an earlier release.                     | ✅      |
| NFR-COST-01 | Phase 1 hosting cost for a handful of users stays within or near the AWS free tier.                                                | ✅      |

## 7. Success metrics

| Metric                                 | Phase 1 target                         |
| -------------------------------------- | -------------------------------------- |
| Time to enter an 18-hole round         | < 2 minutes for a returning user       |
| Card marks per hole                    | ≤ 7 short tokens                       |
| Rounds entered per active user / month | ≥ 3 (self-reported in Phase 1)         |
| Validation errors per round entered    | Trending down after the first 3 rounds |
| Practice priority acted on             | Qualitative feedback from buddy group  |

Phase 1 collects no telemetry (NFR-PRIV-01), so metrics are gathered by talking to users. Phase 2
adds opt-in, privacy-preserving product analytics.

## 8. Roadmap

Each phase is shippable on its own. Monetization arrives only once there is something worth paying
for and the cost to serve is measurable.

### Phase 1: Paper-card SG, offline (this release) ✅

Everything marked ✅ above. Free, no account. Hosted on AWS (dev + prod) for a small group.

### Phase 2: Accounts and sync (web)

- **Sign in with Google** (FR-ACCT-01..05), chosen by the owner over a separate identity service:
  every target golfer already has a Google account and there is no password or user pool to run.
- Local-first sync (FR-SYNC-01..06): IndexedDB stays the source of truth on each device; a sync API
  merges changes by client-generated UUID and `updatedAt`, with tombstones for deletes. Works with
  intermittent connectivity.
- Authenticated, per-user API (NFR-SEC-03): API Gateway verifies the Google ID token, a Lambda
  function stores each golfer's data in DynamoDB under their Google account ID (ADR 0011).
- Handicap-matched baselines (FR-SG-08), CSV export (FR-DATA-05),
  drill library (FR-SG-09), course data integration (FR-COURSE-04).
- Opt-in analytics; status page; error reporting.

### Phase 3: Native apps and on-course capture

- Native iOS and Android apps (Expo/React Native) sharing the TypeScript SG engine and sync
  contract; offline-first by design.
- On-course entry with GPS distances to the green, optional shot-by-shot mode, Apple Watch / Wear OS
  quick-entry.
- Photo capture of the scorecard with on-device OCR of the notation (stretch).

### Phase 4: Coaching and community

- Coach accounts with a student roster, shared read-only dashboards, lesson notes.
- Practice plans with goals and progress tracking; practice-session logging.
- Private groups for buddies: leaderboards by SG category, not just score.

### Phase 5: AI coach

- Conversational coach grounded in the golfer's own SG data ("why am I losing strokes from
  150–200?", "build me a 45-minute practice plan").
- Round recaps, trend explanations, and drill recommendations generated from tool calls over the
  user's data, never from guesswork.
- Delivered through an application-owned **AI gateway**: provider-agnostic, per-user quotas and
  metering, prompt/version management, evaluation suite, and PII minimization.
- Self-hosted or fine-tuned open models only once volume and margins justify them (see §9).

## 9. Monetization (Phases 2–5)

| Tier                | Price (indicative)      | Includes                                                                                                                   |
| ------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Free**            | $0                      | Everything in Phase 1, local-only; unlimited rounds; JSON backup.                                                          |
| **Pro**             | ~$5/month or ~$40/year  | Sync across devices, handicap-matched baselines, trends beyond 20 rounds, drill library, CSV, native app premium features. |
| **Pro + AI coach**  | ~$10/month or ~$80/year | Pro plus AI coach with a monthly usage allowance.                                                                          |
| **Coach / Academy** | ~$20–50/month per coach | Student roster, shared dashboards, lesson notes, bulk invite; academy billing.                                             |

Principles:

- **Free stays genuinely useful.** Offline SG on one device is the funnel and must not be crippled.
- **Charge for ongoing cost or ongoing value:** sync and storage, AI inference, coaching workflow.
- **Web billing through Stripe; in-app purchase on iOS/Android** as store rules require, with one
  entitlement service as the source of truth.
- **AI unit economics first.** Meter tokens per user from day one; set allowances so inference stays
  below ~30% of the AI tier's revenue. Start on hosted models; consider self-hosting when monthly
  inference spend makes reserved GPU capacity cheaper and the evaluation suite proves quality parity.
- **Data is the moat.** With consent, aggregated and anonymized SG data can produce amateur
  baselines by handicap that are better than published tables, feeding back into FR-SG-08.

## 10. Open questions

| #   | Question                                                                                                                                                                   | Owner   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Q1  | Source for handicap-matched and scratch expected-strokes tables (licensing, accuracy).                                                                                     | Product |
| Q2  | ~~Should the unauthenticated Fastify course/round endpoints be disabled or removed until Phase 2?~~ Resolved in 1.2: removed; authenticated sync replaces them in Phase 2. | Eng     |
| Q3  | ~~Identity provider for Phase 2?~~ Resolved in 1.4: Google sign-in; Sign in with Apple added with the iOS app (FR-ACCT-06).                                                | Eng     |
| Q4  | Expo vs fully native Swift/Kotlin for Phase 3, given watch support needs.                                                                                                  | Eng     |
| Q5  | Is a custom domain needed before sharing with the buddy group?                                                                                                             | Product |

## 11. Revision history

| Version | Change                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0     | Reverse-engineered from the implemented v1 (PR #1, PR #2).                                                                                                                                                                                                                                                                                                                                                                             |
| 1.1     | Cycle 1 gap analysis closed three gaps: FR-SG-07 (baseline selector, promised in early design but missing), FR-CARD-01..04 (card guide reworked to be scorecard-agnostic, pocket sheet with QR code), NFR-OPS-01 (one-command AWS bootstrap).                                                                                                                                                                                          |
| 1.2     | Resolved Q2 (owner review): the unauthenticated course/round/stats API endpoints and the server-side SQLite store were removed. The API is now a stateless static host with health checks; server-side data returns only with Phase 2 authenticated, per-user sync (NFR-SEC-03).                                                                                                                                                       |
| 1.3     | Owner UX review: course setup is no longer required. Rounds carry their own par/yardage (FR-ENTRY-01, FR-COURSE-01..03 rewritten; FR-ENTRY-07 migration). Entry became a guided one-question-per-screen flow (FR-ENTRY-05) with the card-line parser pulled forward from Phase 2 as an optional shortcut (FR-ENTRY-06). New home/results requirements FR-HOME-01..05 (course-photo hero, practice-first drill, trend, mobile tab bar). |
| 1.4     | Owner request: accounts to save strokes gained and track progress. Added §5.7 (FR-ACCT-01..06, FR-SYNC-01..06). Owner chose Google sign-in (Q3 resolved). Phase 2 roadmap updated to API Gateway + Lambda + DynamoDB (ADR 0011).                                                                                                                                                                                                       |
| 1.5     | Owner request: saved courses and backup import are not needed yet. Removed FR-COURSE-01/03 and FR-DATA-03; FR-DATA-02 is now "Download my data" (export only). Course pre-fill will come from a course data integration (FR-COURSE-04).                                                                                                                                                                                                |
