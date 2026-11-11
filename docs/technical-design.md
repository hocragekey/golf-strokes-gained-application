# Technical Design: Golf Strokes Gained

| Field  | Value                                                                |
| ------ | -------------------------------------------------------------------- |
| Status | Matches PRD v1.2 (Phase 1 implemented)                               |
| PRD    | [docs/prd.md](prd.md); requirement IDs are cited as `FR-*` / `NFR-*` |
| ADRs   | [docs/adr](adr)                                                      |

This document explains **how** the product described in the PRD is built. Sections cite the
requirements they satisfy, and [§12](#12-traceability-matrix) maps every Phase 1 requirement to
code and tests.

## 1. System overview

```text
                     ┌──────────────────────── Browser / installed PWA ────────────────────────┐
 paper card ──type──▶│ React UI ──▶ TanStack Query ──▶ LocalStore ──▶ Dexie ──▶ IndexedDB      │
                     │                                     │                                    │
                     │                                     └──▶ @golf-sg/shared (SG engine)     │
                     │ Service worker (Workbox): precached app shell, offline navigation        │
                     └─────────────────────────────────────▲────────────────────────────────────┘
                                                           │ static files only (HTTPS)
               AWS: CloudFront (OAC, headers, SPA rewrite) ─┴─ private S3 bucket   [dev | prod]
```

- **Local-first** (ADR 0003): IndexedDB is the system of record; all computation runs on-device
  (FR-DATA-01, FR-PWA-01). Nothing is sent to a server in Phase 1 (NFR-PRIV-01).
- **One domain engine** (NFR-PORT-01): `packages/shared` is pure TypeScript with Zod as its only
  runtime dependency. The web app, the API, and future native apps import the same code.
- **Static hosting** (ADR 0007): the production artifact is a static bundle on S3 + CloudFront per
  environment.
- **Serverless, AWS-native backend** (ADR 0012): the only server code is the sync Lambda behind
  API Gateway; there is no app server or container.

## 2. Repository layout

| Path                       | Responsibility                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| `packages/shared/src`      | `schemas.ts` (Zod contracts), `baseline.ts`, `strokes-gained.ts`, `validation.ts`, `insights.ts` |
| `apps/web/src/data`        | `db.ts` (Dexie schema), `store.ts` (LocalStore), `hooks.ts` (queries), `preferences.ts`          |
| `apps/web/src/pages`       | Route components: Dashboard, Rounds, RoundEntry, RoundDetail, CardGuide, Account                 |
| `apps/web/src/components`  | `Sg` (bars/values), `BaselineSelect`, `QrCode`, scorecard helpers                                |
| `apps/sync/src`            | Sync API Lambda: handler, DynamoDB repository (section 13.1)                                     |
| `infra/cloudformation`     | `bootstrap.yml` (OIDC + IAM), `web.yml` (S3 + CloudFront per environment)                        |
| `scripts/aws-bootstrap.sh` | One-command AWS + GitHub environment setup                                                       |
| `e2e`                      | Playwright tests against the production build                                                    |
| `site`                     | Static marketing and architecture page published to GitHub Pages (ADR 0009)                      |

Toolchain: Node (`.nvmrc`), pnpm workspaces, strict TypeScript, ESLint (type-checked, zero
warnings), Prettier, Vitest, Playwright, Husky + lint-staged + commitlint. See
[engineering standards](engineering-standards.md).

## 3. Data model

All entities use client-generated UUIDs and ISO-8601 timestamps so that multiple devices can create
data offline and later sync without ID collisions (Phase 2).

### Course (legacy)

Saved courses were removed in PRD 1.5; the app no longer creates them. The `courses` table and
`Course` schema remain so data from earlier versions still exports and syncs. Rounds never
reference a course (ADR 0010); a course data integration (FR-COURSE-04) will fill par and yardage.

| Field                    | Type                       | Rules                                                   |
| ------------------------ | -------------------------- | ------------------------------------------------------- |
| `id`                     | UUID                       |                                                         |
| `name`                   | string                     | 1–100 chars, trimmed                                    |
| `tees`                   | string                     | ≤ 40 chars                                              |
| `holes[]`                | `{ number, par, yardage }` | exactly 9 or 18, numbered 1..n; par 3–6; yardage 50–800 |
| `createdAt`, `updatedAt` | ISO datetime               |                                                         |

### Round and HoleEntry (FR-ENTRY-01, FR-ENTRY-02)

A round is self-contained: it carries the par and yardage of every hole it played (`layout`), so
the SG engine never needs a saved course (ADR 0010).

| Field                | Type / domain                                          | Notes                                        |
| -------------------- | ------------------------------------------------------ | -------------------------------------------- |
| `round.id`           | UUID                                                   |                                              |
| `courseName`, `tees` | string ≤ 100 / ≤ 40, may be empty                      | display only                                 |
| `layout[]`           | `{ number, par, yardage }`                             | one per played hole; par 3–6; yardage 50–800 |
| `playedOn`           | ISO date                                               | defaults to today in local time              |
| `notes`              | string ≤ 1000                                          |                                              |
| `holes[]`            | 1–18 `HoleEntry`, numbered 1..n                        |                                              |
| `score`              | 1–20                                                   | includes penalties                           |
| `teeResult`          | `fairway \| left \| right \| short \| penalty \| null` | required on par 4/5, null on par 3           |
| `approachYards`      | 1–700 or null                                          | required on par 4/5; par 3 uses hole yardage |
| `approachLie`        | `tee \| fairway \| rough \| sand \| recovery`          | `tee` only on par 3                          |
| `gir`                | boolean                                                |                                              |
| `missDirection`      | `left \| right \| long \| short \| null`               | only when not GIR                            |
| `shortGameShots`     | 0–10                                                   | non-putt shots inside ~50 yds                |
| `shortGameYards`     | 1–60 or null                                           | first short-game shot                        |
| `shortGameLie`       | `fringe \| fairway \| rough \| sand \| null`           |                                              |
| `firstPuttFeet`      | 1–150 or null                                          | required iff putts > 0                       |
| `putts`              | 0–10                                                   | 0 = holed from off the green                 |
| `penalties`          | 0–10                                                   |                                              |

The card notation (FR-CARD-01) maps one-to-one onto these fields:
`Score`→`score`; `Tee`→`teeResult`; `Approach` yards+lie→`approachYards`/`approachLie`;
`Green` ✓/miss→`gir`/`missDirection`; `Short game` n@yds+lie→`shortGame*`;
`Putts` n@ft→`putts`/`firstPuttFeet`; `+n`→`penalties`. `parseHoleNotation(line, par)` in
`packages/shared/src/notation.ts` implements this mapping for the optional card-line shortcut
(FR-ENTRY-06) and returns a human-readable error naming the first missing or invalid token.

### Storage

- **Web:** Dexie database `golf-sg`. Version 1: `courses: 'id, name'`, `rounds: 'id, courseId, playedOn'`.
  Version 2 (FR-ENTRY-07): `rounds: 'id, playedOn'`; its upgrade copies each round's course name,
  tees and par/yardage into the round (`roundFromV1` in `data/legacy.ts`) and drops `courseId`.
  Rounds whose course was missing get an empty layout and are hidden, as they were in v1.
  Schema changes add a Dexie version with an upgrade function; never edit an existing version.
- **Preferences:** per-device UI preferences (comparison baseline) live in `localStorage`
  (`golf-sg.baseline`), not IndexedDB, because they are not user data and will not sync.
- **API:** stores no data. Server-side persistence arrives with Phase 2 sync (§13).

## 4. Strokes-gained engine (FR-SG-01, NFR-PORT-01)

### 4.1 Expected strokes

`Baseline.expectedStrokes(distance, lie)` returns the expected number of strokes to hole out:
distance is feet on the `green`, yards elsewhere; lies are `tee | fairway | rough | sand |
recovery | green`. Tables are piecewise-linear interpolated and clamped to their range; distance 0
returns 0.

| Baseline | ID         | Definition                                                                                               |
| -------- | ---------- | -------------------------------------------------------------------------------------------------------- |
| PGA Tour | `pga-tour` | Tables adapted from Broadie, _Every Shot Counts_ (default)                                               |
| Scratch  | `scratch`  | `scaledBaseline(pgaTour, 0.06)`: `E' = E + 0.06·max(0, E − 1)`, ≈ 3 strokes/18 weaker on a par-72 course |

The scaled form ([ADR 0008](adr/0008-scratch-baseline-estimate.md)) keeps tap-ins at 1 and holed balls at 0, preserves monotonicity, and is labelled
"(est.)" in the UI until sourced tables replace it (PRD Q1). `getBaseline(id)` falls back to the
default for unknown IDs so a stale preference can never break the app.

### 4.2 Positions recorded per hole

`tee (yardage, tee)` → `approach (approachYards, approachLie)` → `short game (shortGameYards,
lie)` → `first putt (firstPuttFeet, green)` → `holed`. On par 3s the approach position is the tee.
Short-game lies map `fringe`/`fairway` → `fairway`, `rough` → `rough`, `sand` → `sand`.

### 4.3 Category formulas

With `E` the baseline, `before = score − putts − shortGameShots − penalties − 1` (long-game strokes
before the approach), `teePen` = penalties if `teeResult = penalty` (par 4/5), else 0:

| Category         | Formula                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| Off the tee      | par 3: 0; else `E(tee) − E(approach) − before − teePen`                                                      |
| Approach         | `E(approach) − E(next) − 1 − (penalties − teePen) − (par 3 ? before : 0)`, `next` = short game or first putt |
| Around the green | if short game: `E(shortGame) − E(firstPutt or holed) − shortGameShots`, else 0                               |
| Putting          | if putts > 0: `E(firstPutt) − putts`, else 0                                                                 |
| Total            | `E(tee) − score`                                                                                             |

**Invariant:** the four categories sum to the total for every hole (tested). Values are rounded to
two decimals per hole; aggregates sum rounded hole values.

Known simplifications (ADR 0004): par-5 lay-ups and recoveries before the recorded approach count
toward off the tee; intermediate long-game positions are not recorded.

## 5. Validation (FR-ENTRY-03)

`holeEntryIssues(hole, entry)` returns `{ path, message }[]`; `roundIssues` prefixes paths with
`holes.<i>.` so the UI can highlight the exact cell. Rules:

- tee result required on par 4/5 and forbidden on par 3; approach yards required on par 4/5;
  `tee` lie only on par 3; approach no longer than the hole + 50 yds
- first-putt feet required iff putts > 0
- short-game distance and lie required iff short-game shots > 0
- GIR impossible with short-game shots, or if `score − max(putts, 1) > par − 2` (allows hole-outs)
- miss direction only when not GIR
- score at least the strokes implied by the recorded shots

The same functions run in the browser store and the sync API, so the rules cannot drift.

## 6. Insights (FR-SG-02 … FR-SG-07)

`computeStats(rounds, baseline)` orders rounds chronologically and returns:

- `sgPer18`: category totals × 18 / holes played
- `traditional`: scoring average per 18, fairway % and miss left/right % (par 4/5 drives), GIR %,
  putts per 18, up-and-down % (missed greens with short game holed in ≤ 2 strokes)
- buckets: approach by distance (`<100`, `100–150`, `150–200`, `200+` yds, par 3s use hole
  yardage), short game by lie, putting by first-putt band (`0–5`, `6–10`, `11–20`, `21–40`, `40+` ft)
- `approachMisses` counts by direction
- `priorities`: categories sorted by per-18 SG, worst first, each with a focus line naming the worst
  bucket that has ≥ 3 samples (`MIN_SAMPLE`)
- `trend`: per-round summaries

Measured cost: `computeStats` over 100 eighteen-hole rounds takes ~2–3 ms in Node on a laptop,
well inside NFR-PERF-01's 100 ms phone budget.

## 7. Web application

### 7.1 Routes

| Path                              | Page            | PRD                            |
| --------------------------------- | --------------- | ------------------------------ |
| `/`                               | Dashboard       | FR-HOME-01..04, FR-SG-02..07   |
| `/rounds`                         | Rounds          | FR-ENTRY-04, FR-SG-06          |
| `/rounds/new`, `/rounds/:id/edit` | RoundEntry      | FR-ENTRY-01..06                |
| `/rounds/:id`                     | RoundDetail     | FR-SG-01, FR-SG-07, FR-HOME-03 |
| `/guide`                          | CardGuide       | FR-CARD-01..05                 |
| `/data`, `/backup`                | redirect to `/` | FR-DATA-02 (removed)           |

`BrowserRouter` uses `import.meta.env.BASE_URL`, so the app can be hosted at a sub-path.

### 7.2 State and data flow

- `LocalStore` is the only data access layer; components never touch Dexie directly. It validates
  every write with the shared schemas and validation rules and throws `StoreError` with field-level
  issues.
- `saveRound` validates the round against its own `layout`, then writes it and its outbox entry in
  one read-write transaction.
- TanStack Query caches reads with `networkMode: 'always'` (local data never waits for the network)
  and `staleTime: Infinity`; every mutation invalidates all queries.
- Query keys include the selected baseline ID (`['stats', limit, baselineId]`, etc.), so switching
  baseline (FR-SG-07) recomputes on demand and keeps both results cached.
- `useBaselineId()` reads `localStorage` through `useSyncExternalStore`, so every component and
  every open tab update together.

### 7.3 Offline and updates (FR-PWA-01..04, FR-DATA-04)

- `vite-plugin-pwa` (Workbox `generateSW`) precaches all built JS, CSS, HTML, SVG, PNG, WebP, and the
  manifest; navigations fall back to `index.html` (except `/api/*`).
- `navigator.storage.persist()` is requested at startup.
- Hosting serves `index.html` and `sw.js` with no-cache and hashed assets as immutable, so a new
  release is picked up on the next launch while old clients keep loading their own assets.
- Connectivity is never shown in the UI (FR-PWA-03 removed); sync retries on `online` and focus.

### 7.4 Card guide and pocket sheet (FR-CARD-01..05)

`CardGuide` renders the notation table, worked examples, and an 18-row pocket sheet that starts on
a new page when printed. `QrCode` builds the QR matrix on-device with `qrcode` (`QRCode.create`) and
renders it as inline SVG `<path>` elements, so it needs no network, no `data:` URLs, and no
`innerHTML`. The encoded URL is `origin + BASE_URL + 'guide'`, so a sheet printed from dev points at
dev and one printed from prod points at prod.

### 7.5 Guided round entry (FR-ENTRY-01, FR-ENTRY-05, FR-ENTRY-06)

`RoundEntry` is a small state machine: a details step, then for each hole the steps from
`stepsFor(par)`: `layout → score → tee → approach → green → short → putts → penalties → review`,
with `tee` and `approach` dropped on par 3s. Single-choice answers (`Choices`, buttons with
`aria-pressed`) update the draft and advance; steps with a follow-up number (approach yards,
short-game yards, first putt) show a Next button. A hole whose par and yardage are already known
(e.g. when editing) starts at `score`. The review step shows the hole as a card line
and lists `validateRow` issues, each with a Fix link back to the step that owns the field
(`FIELD_STEP`). The side scorecard (`aria-label="Scorecard"`) shows hole status (todo/done/error),
jumps to any hole, and finishes the round early. The card-line shortcut runs `parseHoleNotation`
and jumps straight to the review step. Drafts stay as strings (`HoleDraft`, `LayoutDraft`) and are
validated with the same shared schema and rules on save.

### 7.6 UI

Responsive layout capped at ~1160 px (NFR-UX-01). Home starts with a full-bleed course photo hero
(`components/Hero.tsx`, FR-HOME-01): `public/hero-course.webp` (1600 px) and an 800 px variant via
`image-set`, both precached as `webp` so the hero works offline. The photo is Unsplash `photo-1500932334442-8761ee4810a7`
(Unsplash License: free for commercial use, no attribution required), re-encoded locally; swap it
for owned photography before any paid launch. Results lead with
`PracticeFirst` (weakest category + a drill from `DRILLS`, FR-HOME-03), and the dashboard draws an
inline SVG `Trend` of total SG per round (FR-HOME-04). Below 640 px the nav becomes a fixed bottom
tab bar (FR-HOME-05).
Form controls have labels or `aria-label`s, invalid cells set `aria-invalid`, and errors render
with `role="alert"` (NFR-A11Y-01).

## 8. Server

There is no app server. S3 + CloudFront serve the PWA, and the only server code is the sync Lambda
behind API Gateway (section 13.1, ADR 0011). The earlier Fastify static host and its container image
were removed (ADR 0012); the even earlier unauthenticated course/round/stats endpoints went in PRD
1.2 (Q2). Any server-side data API must ship with authentication and per-user authorization
(NFR-SEC-03).

## 9. Infrastructure and deployment (NFR-SEC-01, NFR-OPS-01, NFR-COST-01)

| Component                  | Design                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bootstrap.yml` (once)     | GitHub OIDC provider (or reuse), `golf-sg-deploy-{dev,prod}` roles trusted only for `repo:<owner>/<repo>:environment:<env>`, and `golf-sg-cfn-execution-{dev,prod}` roles that only CloudFormation can assume. Each deploy role may only pass its own environment's execution role.                                                                                     |
| `web.yml` (per env)        | Private, versioned, AES-256-encrypted S3 bucket, TLS-only policy, public access blocked; CloudFront with Origin Access Control, HTTPS redirect, HTTP/2+3, response headers policy (CSP, HSTS, nosniff, frame deny, referrer policy), CloudFront Function SPA rewrite, no-cache behaviors for `/index.html` and `/sw.js`; optional ACM certificate and Route 53 aliases. |
| `deploy-web.yml`           | Reusable workflow: build → OIDC assume role → `cloudformation deploy` → `s3 sync` hashed assets immutable, app shell no-cache → CloudFront invalidation → smoke test (root, deep link, CSP header).                                                                                                                                                                     |
| `release.yml`              | `deploy-dev` on every push to `main`; `deploy-prod` after a release is cut and dev succeeds, gated by the `prod` environment's required reviewer. Disabled until `AWS_DEPLOY_ENABLED=true`.                                                                                                                                                                             |
| `scripts/aws-bootstrap.sh` | Deploys the bootstrap stack (reusing an existing OIDC provider), creates the `dev`/`prod` GitHub environments restricted to `main` with a prod reviewer, and sets all variables. Idempotent.                                                                                                                                                                            |

Region `us-east-1` (CloudFront certificates must live there). Step-by-step: [deploy-aws.md](deploy-aws.md).

## 10. CI/CD and supply chain (NFR-QUAL-01, NFR-SEC-02)

- **CI** (`ci.yml`): format check, lint, typecheck, unit/component tests with coverage thresholds,
  build, Playwright E2E (incl. offline reload), cfn-lint + checkov, and a
  single `CI OK` aggregate check for branch protection.
- **Security** (`security.yml`, `codeql.yml`): dependency review, gitleaks, actionlint + zizmor,
  CodeQL for TypeScript and Actions. Dependabot for npm and Actions.
- **Release** (`release.yml`): release-please (Conventional Commits → semver + changelog), then AWS
  deploys.
- **Pages** (`pages.yml`): publishes the static marketing/architecture page in `site/` to GitHub
  Pages on changes to `main` (ADR 0009). The app itself is never served from Pages.
- All third-party actions are pinned to full commit SHAs; workflows default to `contents: read`,
  set timeouts and concurrency, and check out with `persist-credentials: false`.

## 11. Testing strategy

| Layer      | Tool                     | Scope                                                                                                                                   |
| ---------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Domain     | Vitest                   | baselines (interpolation, scratch scaling), SG formulas and the sum invariant, validation rules, insights                               |
| Data       | Vitest + fake-indexeddb  | LocalStore CRUD, data download, Dexie v1→v2 migration, baseline selection                                                               |
| Components | Vitest + Testing Library | every page, including baseline switching, card guide, pocket sheet and QR                                                               |
| Sync API   | Vitest + DynamoDB Local  | handler auth/validation, push/pull/delete, conditional writes, tombstones, cursor paging, cross-user isolation                          |
| End-to-end | Playwright               | production build: hero → guided round with no course setup (incl. card line) → SG → practice card; offline reload with data; card guide |
| Infra      | cfn-lint, checkov        | template validity and security posture (skips justified inline)                                                                         |

## 12. Traceability matrix

| Requirement             | Implementation                                                                                                          | Verification                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| FR-CARD-01..05          | `apps/web/src/pages/CardGuide.tsx`, `components/QrCode.tsx`                                                             | `pages.test.tsx` (card guide), `e2e/golf.spec.ts` (card guide)                         |
| FR-COURSE-02            | `data/store.ts` (`saveRound`), `shared` round schema (`layout`)                                                         | `store.test.ts`                                                                        |
| FR-ENTRY-01..05         | `pages/RoundEntry.tsx`, `components/scorecard.ts`, `shared/validation.ts`, `store.saveRound`                            | `validation.test.ts`, `scorecard.test.ts`, `store.test.ts`, `pages.test.tsx`, E2E      |
| FR-ENTRY-06             | `shared/notation.ts` (`parseHoleNotation`), `pages/RoundEntry.tsx`                                                      | `notation.test.ts`, `pages.test.tsx`, E2E                                              |
| FR-ENTRY-07             | `data/db.ts` (version 2 upgrade), `data/legacy.ts`                                                                      | `store.test.ts` (migration)                                                            |
| FR-HOME-01..05          | `components/Hero.tsx`, `components/Practice.tsx`, `components/Trend.tsx`, `App.tsx`, `styles.css`                       | `pages.test.tsx` (Dashboard, RoundDetail), E2E                                         |
| FR-SG-01                | `shared/strokes-gained.ts`                                                                                              | `strokes-gained.test.ts` (sum invariant)                                               |
| FR-SG-02..06            | `shared/insights.ts`, `pages/Dashboard.tsx`                                                                             | `insights.test.ts`, `pages.test.tsx`, E2E                                              |
| FR-SG-07                | `shared/baseline.ts` (`scratchBaseline`, `getBaseline`), `data/preferences.ts`, `components/BaselineSelect.tsx`         | `baseline.test.ts`, `store.test.ts`, `pages.test.tsx`                                  |
| FR-DATA-01..04          | `data/db.ts`, `data/store.ts`, `main.tsx`                                                                               | `store.test.ts`                                                                        |
| FR-PWA-01..04           | `vite.config.ts`, `web.yml` cache behaviors                                                                             | E2E offline test, deploy smoke test                                                    |
| FR-ACCT-01..05          | `auth/google.ts`, `auth/context.tsx`, `pages/Account.tsx`, `App.tsx`, `config/app.json`                                 | `account.test.tsx`                                                                     |
| FR-SYNC-01..06          | `shared/sync.ts`, `apps/sync/src/*`, `data/db.ts` (v3), `store.ts` (outbox), `sync/engine.ts`, `sync/api.ts`, `api.yml` | `sync.test.ts`, `handler.test.ts`, `*-repo.test.ts` (DynamoDB Local), `engine.test.ts` |
| NFR-SEC-01, NFR-OPS-01  | `infra/cloudformation/*`, `deploy-web.yml`, `release.yml`, `scripts/aws-bootstrap.sh`                                   | cfn-lint, checkov, deploy smoke test                                                   |
| NFR-SEC-02, NFR-QUAL-01 | `.github/workflows/*`, `.github/dependabot.yml`                                                                         | required `CI OK` check                                                                 |

## 13. Phase 2+ architecture (design intent)

- **Accounts and sync:** see §13.1 (Google sign-in, API Gateway + Lambda + DynamoDB; ADR 0011).
- **Native (Phase 3):** Expo/React Native apps importing `@golf-sg/shared`; SQLite on device with the
  same sync protocol. Language-neutral JSON test vectors guard any non-TypeScript port.
- **AI gateway (Phase 5):** a service that owns provider keys, enforces per-user quotas and
  entitlements, meters tokens for billing, versions prompts, and exposes tools that read only the
  calling user's SG data. Evaluations run in CI against fixed fixtures.
- **Billing:** a single entitlement service fed by Stripe webhooks (web) and App Store / Play
  server notifications (mobile).

### 13.1 Accounts and sync (FR-ACCT, FR-SYNC; ADR 0011)

**Identity.** The web app loads Google Identity Services (`accounts.google.com/gsi/client`) only
when a client ID is configured (`googleClientId` in `config/app.json`, overridable with
`VITE_GOOGLE_CLIENT_ID`; FR-ACCT-05) and the golfer opens the
Account page or was signed in before. Google returns an ID token (a JWT, 1 hour). The token stays
in memory only; the profile (`sub`, email, name, picture) is cached in `localStorage` so the
signed-in state shows offline. When the token expires the app asks GIS for a new one silently
(`auto_select`); if that needs user interaction the status becomes "Sign in again to sync" and
local use carries on. Native apps later use Google's iOS/Android SDKs (and Sign in with Apple on
iOS) against the same API: the account key is the token's `iss` + `sub`.

**Edge.** CloudFront routes `/api/*` to an API Gateway HTTP API in the same environment, so the
browser calls a same-origin API (no CORS, CSP `connect-src 'self'`). The HTTP API's JWT authorizer
checks signature (Google JWKS), `iss = https://accounts.google.com`, `aud = <client ID>` and
expiry before any code runs. Routes:

| Route                 | Body / query                          | Result                                                               |
| --------------------- | ------------------------------------- | -------------------------------------------------------------------- |
| `POST /api/sync`      | `{ changes: Change[] }` (max 100)     | `{ applied: string[], stale: string[], rejected: [{ id, reason }] }` |
| `GET /api/sync`       | `?since=<cursor>` (omit = everything) | `{ changes: Change[], cursor, more }` (pages of 200)                 |
| `DELETE /api/account` | none                                  | `204`; every item for the caller is deleted                          |

`Change = { kind: 'round' | 'course', id, updatedAt, deletedAt: string | null, data?: Round | Course }`
(shared Zod schema in `packages/shared/src/sync.ts`). A change with `deletedAt` is a tombstone and
carries no data. Round data is validated with the same schemas and `roundIssues` as the app.

**Storage.** One DynamoDB table (on-demand, point-in-time recovery, AWS-owned encryption):

| Attribute  | Value                                                               |
| ---------- | ------------------------------------------------------------------- |
| `pk`       | `USER#<sub>` from the verified token, never from the request body   |
| `sk`       | `ROUND#<id>` or `COURSE#<id>`                                       |
| `version`  | `updatedAt` in epoch ms, compared for last-writer-wins              |
| `syncedAt` | server timestamp of the write; sort key of local index `bySyncedAt` |
| `change`   | the validated `Change` (entity JSON, or a tombstone)                |

Writes are conditional: `attribute_not_exists(pk) OR version < :incoming`, so an older change
can never overwrite a newer one (it is reported as `stale` and the newer copy comes back on the next
pull). Pull queries `bySyncedAt` for `syncedAt > since − 5 s` (overlap absorbs clock skew between
concurrent Lambda writes; applying a change twice is harmless). Tombstones are kept so a device
that was offline for months still learns about deletes. Every query uses the caller's `pk`, which
is the per-user authorization (NFR-SEC-03).

**Compute.** One Lambda function (Node.js 22, arm64), bundled with esbuild from `apps/sync`
(`@golf-sg/sync`). The handler is a pure function of the request, the verified `sub` and a
repository interface, so it is tested against an in-memory repository and DynamoDB Local.

**Client.** Dexie version 3 adds `pending` (outbox keyed `kind:id`) and `meta` (sync cursor and
the `sub` the device last synced as). Every local save and delete records a pending
entry. The sync engine runs on sign-in, on the `online` event, when the tab becomes visible, a few
seconds after a local change:

1. Push pending entries (current entity, or a tombstone if it is gone), in batches of 100.
2. Remove pending entries whose `updatedAt` did not change while the push was in flight.
3. Pull since the stored cursor and apply each change if it is newer than the local copy and has
   no newer pending local edit (last writer wins, FR-SYNC-04); tombstones delete locally.
4. Store the new cursor and "last synced" time.

First sign-in on a device (or as a different `sub`) marks every local entity pending, so existing
rounds upload (FR-SYNC-01). Signing out first tries a last sync. If the outbox is then empty the
device is cleared; otherwise rounds, outbox and sync state stay, so unsent edits and deletes upload
when the same golfer signs back in (FR-ACCT-03). Deleting the account clears the outbox and then
the device (FR-ACCT-04). The UI never shows sync state except an expired sign-in (FR-SYNC-05). The
access token switches to a new account only after the outbox has been re-queued for it.

**Infrastructure.** `infra/cloudformation/api.yml` per environment (table, function, role, log
groups, HTTP API, authorizer, routes, throttled stage). The Lambda bundle is uploaded to the
bootstrap stack's artifact bucket. The web stack takes the API domain as a parameter and adds the
`/api/*` behavior (caching disabled, all viewer headers except `Host` forwarded). Both API and
behavior are skipped while `config/app.json` has no `googleClientId`, so forks without a Google
client still deploy the offline app. Engine work (sync, first-sign-in upload, sign-out reset,
account deletion) is serialized in `auth/context.tsx`, so a sign-out can never interleave with a
pull that writes rounds back.

**CSP additions** (Google Identity Services): `script-src https://accounts.google.com/gsi/client`,
`style-src https://accounts.google.com/gsi/style`, `frame-src https://accounts.google.com/gsi/`,
`connect-src https://accounts.google.com/gsi/`, `img-src https://*.googleusercontent.com`.
