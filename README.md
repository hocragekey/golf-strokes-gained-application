# Golf Strokes Gained

[![CI](https://github.com/hocragekey/golf-strokes-gained-application/actions/workflows/ci.yml/badge.svg)](https://github.com/hocragekey/golf-strokes-gained-application/actions/workflows/ci.yml)
[![CodeQL](https://github.com/hocragekey/golf-strokes-gained-application/actions/workflows/codeql.yml/badge.svg)](https://github.com/hocragekey/golf-strokes-gained-application/actions/workflows/codeql.yml)

Mark a few numbers on your scorecard, type them in after the round, and get **strokes gained**
broken down into off the tee, approach, around the green and putting, plus a ranked list of what
to practice next.

The app is an **offline-first PWA**: data lives on your device (IndexedDB) and all calculations run
in the browser, so it works on a phone with no signal. Install it to your home screen from the
browser menu.

## What to mark on each hole

| Mark               | Meaning                                                                  |
| ------------------ | ------------------------------------------------------------------------ |
| Score              | Strokes on the hole, including penalties                                 |
| Tee (par 4/5)      | F fairway, L left, R right, S short, P penalty/OB                        |
| Approach yds + lie | Yards to the pin for the shot into the green; R rough, B bunker, T trees |
| GIR                | On the green in regulation?                                              |
| Miss               | If not: L, R, Long or Short                                              |
| Short-game shots   | Non-putt shots from inside ~50 yds; yards and lie of the first one       |
| 1st putt ft        | Distance of the first putt (pace it off)                                 |
| Putts, Penalties   | Counts                                                                   |

Par and yardage are entered once per course. The in-app **Card guide** page is printable.

## Quick start

Requirements: Node (see [`.nvmrc`](.nvmrc)) and pnpm (see `packageManager` in
[`package.json`](package.json); `corepack enable` works too).

```bash
pnpm install
pnpm dev            # web on http://localhost:5173, API on :3000
```

Or run the production container:

```bash
docker compose up --build   # http://localhost:3000
```

## Repository layout

| Path              | What                                                                         |
| ----------------- | ---------------------------------------------------------------------------- |
| `packages/shared` | Pure TS domain: Zod schemas, expected-strokes baselines, SG engine, insights |
| `apps/web`        | React + Vite PWA; IndexedDB (Dexie) store; service worker via Workbox        |
| `apps/api`        | Fastify server: serves the PWA and health checks (sync API comes in Phase 2) |
| `infra`           | CloudFormation for AWS hosting (dev/prod)                                    |
| `e2e`             | Playwright tests against the production build, including offline mode        |
| `docs/adr`        | Architecture decision records                                                |

## Common commands

```bash
pnpm lint           # ESLint (strict type-checked), zero warnings
pnpm typecheck      # tsc across all workspaces
pnpm test           # Vitest unit + component + API tests
pnpm test:coverage  # with coverage thresholds enforced
pnpm build          # build all workspaces
pnpm test:e2e       # Playwright (run `pnpm build` first)
```

## Documentation

- [Engineering standards](docs/engineering-standards.md): branching, commits, CI/CD, releases
- [Deploying to AWS](docs/deploy-aws.md): S3 + CloudFront, dev and prod environments
- [Contributing](CONTRIBUTING.md) · [Security policy](SECURITY.md)
- [ADRs](docs/adr), especially [local-first PWA](docs/adr/0003-local-first-pwa.md),
  [strokes-gained model](docs/adr/0004-strokes-gained-model.md) and
  [roadmap](docs/adr/0006-roadmap-platform-evolution.md)

## License

[MIT](LICENSE)
