# 2. TypeScript pnpm monorepo

- Status: Accepted
- Date: 2026-11-07

## Context

The same domain rules (validation, expected strokes, SG) must run in the browser, on the server
and later in native apps. Mismatched implementations would produce different numbers per client.

## Decision

A pnpm workspace with `packages/shared` (pure TS + Zod, no I/O), `apps/web` (React + Vite) and
`apps/api` (Fastify + Drizzle/SQLite). Strict TypeScript, ESLint strict-type-checked, Prettier,
Vitest and Playwright across the repo.

## Consequences

- One source of truth for schemas and math; the API and web app cannot drift.
- `packages/shared` must remain dependency-light and side-effect free.
