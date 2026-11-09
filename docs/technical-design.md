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
  environment. The Fastify API image exists for self-hosting and as the Phase 2 foundation.

## 2. Repository layout

| Path                       | Responsibility                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| `packages/shared/src`      | `schemas.ts` (Zod contracts), `baseline.ts`, `strokes-gained.ts`, `validation.ts`, `insights.ts` |
| `apps/web/src/data`        | `db.ts` (Dexie schema), `store.ts` (LocalStore), `hooks.ts` (queries), `preferences.ts`          |
| `apps/web/src/pages`       | Route components: Dashboard, Rounds, RoundEntry, RoundDetail, Courses, CardGuide, Backup         |
| `apps/web/src/components`  | `Sg` (bars/values), `BaselineSelect`, `QrCode`, `OfflineBadge`, scorecard helpers                |
| `apps/api/src`             | Fastify static host for the PWA plus health/readiness routes; no data endpoints or database      |
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

### Course (FR-COURSE-01)

| Field                    | Type                       | Rules                                                   |
| ------------------------ | -------------------------- | ------------------------------------------------------- |
| `id`                     | UUID                       |                                                         |
| `name`                   | string                     | 1–100 chars, trimmed                                    |
| `tees`                   | string                     | ≤ 40 chars                                              |
| `holes[]`                | `{ number, par, yardage }` | exactly 9 or 18, numbered 1..n; par 3–6; yardage 50–800 |
| `createdAt`, `updatedAt` | ISO datetime               |                                                         |

### Round and HoleEntry (FR-ENTRY-01, FR-ENTRY-02)

| Field                  | Type / domain                                          | Notes                                        |
| ---------------------- | ------------------------------------------------------ | -------------------------------------------- |
| `round.id`, `courseId` | UUID                                                   |                                              |
| `playedOn`             | ISO date                                               | defaults to today in local time              |
| `notes`                | string ≤ 1000                                          |                                              |
| `holes[]`              | 1–18 `HoleEntry`, numbered 1..n                        |                                              |
| `score`                | 1–20                                                   | includes penalties                           |
| `teeResult`            | `fairway \| left \| right \| short \| penalty \| null` | required on par 4/5, null on par 3           |
| `approachYards`        | 1–700 or null                                          | required on par 4/5; par 3 uses hole yardage |
| `approachLie`          | `tee \| fairway \| rough \| sand \| recovery`          | `tee` only on par 3                          |
| `gir`                  | boolean                                                |                                              |
| `missDirection`        | `left \| right \| long \| short \| null`               | only when not GIR                            |
| `shortGameShots`       | 0–10                                                   | non-putt shots inside ~50 yds                |
| `shortGameYards`       | 1–60 or null                                           | first short-game shot                        |
| `shortGameLie`         | `fringe \| fairway \| rough \| sand \| null`           |                                              |
| `firstPuttFeet`        | 1–150 or null                                          | required iff putts > 0                       |
| `putts`                | 0–10                                                   | 0 = holed from off the green                 |
| `penalties`            | 0–10                                                   |                                              |

The card notation (FR-CARD-01) maps one-to-one onto these fields:
`Score`→`score`; `Tee`→`teeResult`; `Approach` yards+lie→`approachYards`/`approachLie`;
`Green` ✓/miss→`gir`/`missDirection`; `Short game` n@yds+lie→`shortGame*`;
`Putts` n@ft→`putts`/`firstPuttFeet`; `+n`→`penalties`.

### Storage

- **Web:** Dexie database `golf-sg`, version 1: `courses: 'id, name'`, `rounds: 'id, courseId, playedOn'`.
  Schema changes add a Dexie version with an upgrade function; never edit an existing version.
- **Preferences:** per-device UI preferences (comparison baseline) live in `localStorage`
  (`golf-sg.baseline`), not IndexedDB, because they are not user data and will not sync.
- **API:** stores no data. Server-side persistence arrives with Phase 2 sync (§13).

### Backup format (FR-DATA-02, FR-DATA-03)

`{ app: 'golf-strokes-gained', version: 1, exportedAt, courses: Course[], rounds: Round[] }`, validated by `backupSchema` and
then by `roundIssues` against each round's course. Import replaces all data inside a single Dexie
transaction, so a failed import leaves existing data untouched.

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

## 5. Validation (FR-ENTRY-03, FR-COURSE-03)

`holeEntryIssues(hole, entry)` returns `{ path, message }[]`; `roundIssues` prefixes paths with
`holes.<i>.` so the UI can highlight the exact cell. Rules:

- tee result required on par 4/5 and forbidden on par 3; approach yards required on par 4/5;
  `tee` lie only on par 3; approach no longer than the hole + 50 yds
- first-putt feet required iff putts > 0
- short-game distance and lie required iff short-game shots > 0
- GIR impossible with short-game shots, or if `score − max(putts, 1) > par − 2` (allows hole-outs)
- miss direction only when not GIR
- score at least the strokes implied by the recorded shots

The same functions run in the browser store, the API, and backup import, so the rules cannot drift.

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

| Path                              | Page        | PRD                   |
| --------------------------------- | ----------- | --------------------- |
| `/`                               | Dashboard   | FR-SG-02..07          |
| `/rounds`                         | Rounds      | FR-ENTRY-04, FR-SG-06 |
| `/rounds/new`, `/rounds/:id/edit` | RoundEntry  | FR-ENTRY-01..05       |
| `/rounds/:id`                     | RoundDetail | FR-SG-01, FR-SG-07    |
| `/courses`                        | Courses     | FR-COURSE-01..03      |
| `/guide`                          | CardGuide   | FR-CARD-01..05        |
| `/backup`                         | Backup      | FR-DATA-02..03        |

`BrowserRouter` uses `import.meta.env.BASE_URL`, so the app can be hosted at a sub-path.

### 7.2 State and data flow

- `LocalStore` is the only data access layer; components never touch Dexie directly. It validates
  every write with the shared schemas and validation rules and throws `StoreError` with field-level
  issues.
- `saveRound` validates and writes inside one read-write transaction over `courses` and `rounds`, so
  a concurrent course deletion in another tab cannot strand a round.
- TanStack Query caches reads with `networkMode: 'always'` (local data never waits for the network)
  and `staleTime: Infinity`; every mutation invalidates all queries.
- Query keys include the selected baseline ID (`['stats', limit, baselineId]`, etc.), so switching
  baseline (FR-SG-07) recomputes on demand and keeps both results cached.
- `useBaselineId()` reads `localStorage` through `useSyncExternalStore`, so every component and
  every open tab update together.

### 7.3 Offline and updates (FR-PWA-01..04, FR-DATA-04)

- `vite-plugin-pwa` (Workbox `generateSW`) precaches all built JS, CSS, HTML, SVG, PNG, and the
  manifest; navigations fall back to `index.html` (except `/api/*`).
- `navigator.storage.persist()` is requested at startup.
- Hosting serves `index.html` and `sw.js` with no-cache and hashed assets as immutable, so a new
  release is picked up on the next launch while old clients keep loading their own assets.
- `OfflineBadge` listens to `online`/`offline` events and shows "Offline · everything still works".

### 7.4 Card guide and pocket sheet (FR-CARD-01..05)

`CardGuide` renders the notation table, worked examples, and an 18-row pocket sheet that starts on
a new page when printed. `QrCode` builds the QR matrix on-device with `qrcode` (`QRCode.create`) and
renders it as inline SVG `<path>` elements, so it needs no network, no `data:` URLs, and no
`innerHTML`. The encoded URL is `origin + BASE_URL + 'guide'`, so a sheet printed from dev points at
dev and one printed from prod points at prod.

### 7.5 UI

Desktop-first layout capped at ~1160 px with card grids, responsive down to phones (NFR-UX-01).
Form controls have labels or `aria-label`s, invalid cells set `aria-invalid`, and errors render
with `role="alert"` (NFR-A11Y-01).

## 8. API (self-hosted static host)

Fastify with `@fastify/helmet` serves the built PWA in the container image, with SPA history
fallback and JSON 404s under `/api`. It is stateless: the only endpoints are `GET /api/health`
(liveness, used by the image `HEALTHCHECK`) and `GET /api/ready` (readiness, used by the CI smoke
test). Tests assert that `/api/courses`, `/api/rounds` and `/api/stats` return 404.

The earlier unauthenticated course/round/stats endpoints and their SQLite store were removed (PRD
Q2, resolved in PRD 1.2). Any server-side data API must ship with authentication and per-user
authorization (NFR-SEC-03); it returns as the Phase 2 sync service.

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
  build, Playwright E2E (incl. offline reload), Docker build + smoke, cfn-lint + checkov, and a
  single `CI OK` aggregate check for branch protection.
- **Security** (`security.yml`, `codeql.yml`): dependency review, gitleaks, actionlint + zizmor,
  CodeQL for TypeScript and Actions. Dependabot for npm, Actions, and Docker.
- **Release** (`release.yml`): release-please (Conventional Commits → semver + changelog), multi-arch
  GHCR image with SBOM and provenance, cosign keyless signing, then AWS deploys.
- **Pages** (`pages.yml`): publishes the static marketing/architecture page in `site/` to GitHub
  Pages on changes to `main` (ADR 0009). The app itself is never served from Pages.
- All third-party actions are pinned to full commit SHAs; workflows default to `contents: read`,
  set timeouts and concurrency, and check out with `persist-credentials: false`.

## 11. Testing strategy

| Layer      | Tool                     | Scope                                                                                                                            |
| ---------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Domain     | Vitest                   | baselines (interpolation, scratch scaling), SG formulas and the sum invariant, validation rules, insights                        |
| Data       | Vitest + fake-indexeddb  | LocalStore CRUD, validation, transactions, course-edit conflicts, backup import, baseline selection                              |
| Components | Vitest + Testing Library | every page, including baseline switching, card guide, pocket sheet and QR                                                        |
| API        | Vitest + Fastify inject  | health, static SPA fallback, data routes absent                                                                                  |
| End-to-end | Playwright               | production build: course → round → SG → priorities; service worker ready → offline reload with data; card guide and pocket sheet |
| Infra      | cfn-lint, checkov        | template validity and security posture (skips justified inline)                                                                  |

## 12. Traceability matrix

| Requirement             | Implementation                                                                                                  | Verification                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| FR-CARD-01..05          | `apps/web/src/pages/CardGuide.tsx`, `components/QrCode.tsx`                                                     | `pages.test.tsx` (card guide), `e2e/golf.spec.ts` (card guide) |
| FR-COURSE-01..03        | `data/store.ts` (`saveCourse`, `deleteCourse`), `pages/Courses.tsx`                                             | `store.test.ts`, `pages.test.tsx` (Courses)                    |
| FR-ENTRY-01..05         | `pages/RoundEntry.tsx`, `shared/validation.ts`, `store.saveRound`                                               | `validation.test.ts`, `store.test.ts`, `pages.test.tsx`, E2E   |
| FR-SG-01                | `shared/strokes-gained.ts`                                                                                      | `strokes-gained.test.ts` (sum invariant)                       |
| FR-SG-02..06            | `shared/insights.ts`, `pages/Dashboard.tsx`                                                                     | `insights.test.ts`, `pages.test.tsx`, E2E                      |
| FR-SG-07                | `shared/baseline.ts` (`scratchBaseline`, `getBaseline`), `data/preferences.ts`, `components/BaselineSelect.tsx` | `baseline.test.ts`, `store.test.ts`, `pages.test.tsx`          |
| FR-DATA-01..04          | `data/db.ts`, `data/store.ts`, `pages/Backup.tsx`, `main.tsx`                                                   | `store.test.ts`, `pages.test.tsx` (Backup)                     |
| FR-PWA-01..04           | `vite.config.ts`, `components/OfflineBadge.tsx`, `web.yml` cache behaviors                                      | E2E offline test, deploy smoke test                            |
| NFR-SEC-01, NFR-OPS-01  | `infra/cloudformation/*`, `deploy-web.yml`, `release.yml`, `scripts/aws-bootstrap.sh`                           | cfn-lint, checkov, deploy smoke test                           |
| NFR-SEC-02, NFR-QUAL-01 | `.github/workflows/*`, `.github/dependabot.yml`                                                                 | required `CI OK` check                                         |

## 13. Phase 2+ architecture (design intent)

- **Sync:** keep IndexedDB authoritative per device. Add `deletedAt` tombstones and a per-device
  outbox; the client pushes changed entities and pulls changes since a server cursor. Conflicts are
  resolved per entity by `updatedAt` (last writer wins), which is safe because a round is normally
  edited on one device. The API contract is generated as OpenAPI from the shared Zod schemas so web
  and native clients share types.
- **Backend:** authenticated API (managed OIDC; JWT verification at the edge) on serverless compute
  (Lambda behind API Gateway or CloudFront) with a managed relational database; every query scoped
  by `userId`. Same CloudFormation + OIDC deployment model, new stacks per environment.
- **Native (Phase 3):** Expo/React Native apps importing `@golf-sg/shared`; SQLite on device with the
  same sync protocol. Language-neutral JSON test vectors guard any non-TypeScript port.
- **AI gateway (Phase 5):** a service that owns provider keys, enforces per-user quotas and
  entitlements, meters tokens for billing, versions prompts, and exposes tools that read only the
  calling user's SG data. Evaluations run in CI against fixed fixtures.
- **Billing:** a single entitlement service fed by Stripe webhooks (web) and App Store / Play
  server notifications (mobile).
