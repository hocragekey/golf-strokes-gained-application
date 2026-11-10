# 12. AWS-native serverless backend; drop the self-hosted container

- Status: Accepted
- Date: 2026-11-10

## Context

The Fastify server in `apps/api` and its container image (Dockerfile, compose file, CI smoke test,
signed GHCR image on each release) predate AWS hosting. ADR 0007 moved the PWA to S3 + CloudFront
and ADR 0011 put the sync API on API Gateway, Lambda and DynamoDB, so the server only served the
built app and health checks for self-hosting, and Playwright used it to serve the production build.
Nothing deployed or used the image. The owner is comfortable binding the backend to AWS.

## Decision

- AWS is the backend platform. Server code is written for API Gateway + Lambda + DynamoDB; we do
  not keep a portable app server or container alongside it.
- Remove `apps/api`, the Dockerfile, `compose.yaml`, the CI container job, the GHCR release image
  and Docker Dependabot updates.
- Playwright serves `apps/web/dist` with `vite preview`, static files like S3 + CloudFront.
- Local development of sign-in and sync proxies `/api` to a deployed environment via
  `VITE_API_PROXY_TARGET`.

## Consequences

- Less to build, patch and audit; no idle compute.
- Self-hosting the app outside AWS is no longer supported. The domain engine (`packages/shared`)
  and the sync protocol stay platform-neutral, so another backend could be added later if needed.
- Supersedes the self-hosting image in ADR 0005.
