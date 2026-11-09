# Contributing

## Workflow

1. Branch from `main`: `feat/<slug>`, `fix/<slug>`, `chore/<slug>`.
2. Commit using [Conventional Commits](https://www.conventionalcommits.org/) (enforced by
   commitlint in a Husky `commit-msg` hook). `feat:` and `fix:` drive the next version.
3. Open a PR. The PR **title** must also be a Conventional Commit; PRs are squash-merged.
4. All required checks must pass (`CI OK`, PR title, secret scan, CodeQL) and review threads
   must be resolved.

## Local checks

Pre-commit runs Prettier and ESLint on staged files (`lint-staged`). Before pushing:

```bash
pnpm lint && pnpm typecheck && pnpm test:coverage && pnpm build && pnpm test:e2e
```

## Code standards

- TypeScript `strict` plus `noUncheckedIndexedAccess`; no `any`, no non-null assertions outside tests.
- Validate at every boundary with the shared Zod schemas (`packages/shared`).
- Domain logic (`packages/shared`) stays pure and framework-free so it runs in the browser,
  server and future native apps.
- Changes to strokes-gained math need unit tests that check the category-sum invariant and,
  for model changes, an ADR.
- Coverage thresholds are enforced in CI (`vitest.config.ts`); don't lower them to pass.
