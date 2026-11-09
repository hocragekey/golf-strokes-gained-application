# 6. Roadmap and platform evolution

- Status: Proposed
- Date: 2026-11-07

## Context

Longer term we want accounts, native mobile apps, AI-assisted coaching and a paid tier, without
rewriting v1.

## Direction

1. **Accounts and sync.** Managed OIDC identity (e.g. Clerk, Auth0 or Cognito) rather than
   home-grown auth. Postgres with per-user row isolation. Offline-first sync: the device stays
   the source of truth for edits; the server merges by UUID with `updatedAt` last-writer-wins at
   entity level, later CRDT/field-level if needed. Free local-only mode remains.
2. **Native apps.** Truly native iOS/Android, most likely Expo/React Native (native UI and
   modules, reuses `packages/shared` unchanged). If a platform-specific stack such as Swift or
   Kotlin is chosen, the SG engine is ported and verified against shared JSON golden test
   vectors exported from the TS test suite. The sync API is described in OpenAPI generated
   from the Zod schemas so native clients get typed SDKs.
3. **On-course capture.** Shot-by-shot entry, GPS distances and watch support in the native apps.
4. **AI coaching.** An `ai-gateway` service that calls hosted model APIs with tool access to
   the user's own SG data (practice plans, round recaps, drill suggestions), with per-user
   metering and quotas. Self-hosted or fine-tuned open models only when usage and margins
   justify the infrastructure cost.
5. **Monetization.** Freemium subscription (free: round SG; Pro: trends, handicap-matched
   baselines, practice plans, AI coach), plus a coach/academy tier with multi-student dashboards.
   Billing through Stripe for web and the app-store billing systems for in-app purchases on mobile.

## Consequences

- v1 decisions (shared pure engine, UUIDs, timestamps, schema-first contracts) already support
  this path.
- Each phase gets its own ADR when it is committed to.
