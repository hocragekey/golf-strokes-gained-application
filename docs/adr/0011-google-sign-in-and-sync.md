# 11. Google sign-in and a per-user sync API on API Gateway, Lambda and DynamoDB

- Status: Accepted
- Date: 2026-11-09

## Context

The owner wants golfers to save their strokes gained to an account and track progress across
devices (PRD 1.4, FR-ACCT, FR-SYNC). The app must stay local-first: it works signed out and with
poor or no signal on the course (ADR 0003). ADR 0006 assumed a managed OIDC provider (Cognito,
Auth0 or Clerk) and a relational database; the owner asked to "just use Google sign-in".

## Decision

- **Identity:** Google is the only sign-in for the web. The Google ID token is verified by the API
  Gateway HTTP API's built-in JWT authorizer (issuer `https://accounts.google.com`, audience = our
  OAuth client ID). No user pool, passwords or identity service to run or pay for. The account key
  is Google's stable `sub`. The token lives in memory only on the client.
- **API:** one Lambda function behind the HTTP API, served same-origin through the existing
  CloudFront distribution at `/api/*`. Three routes: push changes, pull changes since a cursor,
  delete account data.
- **Storage:** one DynamoDB table, partition key `USER#<sub>` taken from the verified token, so
  every read and write is scoped to the caller. Items are whole rounds/courses; a local secondary
  index on `syncedAt` serves incremental pulls.
- **Sync:** IndexedDB stays authoritative on each device. An outbox of pending changes is pushed
  when online; pulls apply server changes. Conflicts resolve per entity by `updatedAt`
  (last writer wins) using conditional writes; deletes are tombstones.

## Alternatives

- **Cognito / Auth0 / Clerk:** more features (email login, passkeys, MFA) but a second identity
  system to configure and, for Auth0/Clerk, to pay for. Not needed while Google is the only login.
- **Verify tokens in Lambda:** extra code and JWKS caching; the HTTP API authorizer does it before
  invocation and rejects bad tokens for free.
- **Aurora/RDS:** relational queries are not needed (all access is "this user's items"), and a
  database server costs money while idle. DynamoDB on-demand costs nothing at rest.
- **Server-only data:** breaks offline entry on the course.

## Consequences

- Golfers without a Google account cannot sign in; they keep the full offline app and JSON backups.
- The native iOS app must add Sign in with Apple (App Store guideline 4.8, FR-ACCT-06). The API
  will then accept a second issuer; items are keyed by `sub`, so Apple accounts get their own
  partition and account linking is a later, separate decision.
- Last-writer-wins can drop an edit made on two devices before either synced. Rounds are almost
  always edited on one device, so this is accepted (FR-SYNC-04).
- Supersedes the identity and database parts of ADR 0006's Phase 2 sketch.
