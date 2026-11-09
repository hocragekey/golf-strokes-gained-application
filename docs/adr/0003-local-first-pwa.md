# 3. Local-first PWA

- Status: Accepted
- Date: 2026-11-07

## Context

Golfers enter data at home today and on the course later, where connectivity is unreliable.
The app must work fully without a network connection.

## Decision

- The web app is the system of record for v1: courses and rounds are stored in **IndexedDB**
  (via Dexie) and all strokes-gained math runs client-side using `packages/shared`.
- A **service worker** (vite-plugin-pwa / Workbox) precaches the app shell; the app is installable.
- `navigator.storage.persist()` is requested to reduce eviction risk; users can **export/import
  a JSON backup** that is validated with the shared schemas before replacing local data.
- Entities use **client-generated UUIDs** and `createdAt`/`updatedAt` timestamps so that a future
  sync service can merge data from several devices without ID collisions.
- The Fastify API only serves the PWA and health checks. It has no course/round endpoints or
  database: they were removed until authenticated, per-user sync is built (see ADR 6).

## Consequences

- No account or server is required to use the app; data is per-device until sync exists.
- Data loss if the browser storage is cleared and no backup exists; mitigated by persistence
  request and backups, eliminated by sync.
- Schema changes need Dexie version migrations as well as SQL migrations.
