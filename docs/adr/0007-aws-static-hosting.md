# 7. AWS static hosting with CloudFormation

- Status: Accepted
- Date: 2026-11-07
- Supersedes: the GitHub Pages deployment in [ADR 0005](0005-ci-cd-and-supply-chain.md)

## Context

We want a shareable `dev` and `prod` deployment on AWS, owned by us, that a few friends can
install as a PWA. v1 is local-first (ADR 0003), so the deployable unit is a static bundle. The
API container is not needed until cloud sync exists.

## Decision

- Host each environment on **S3 (private) + CloudFront with origin access control**. Add
  security headers, an SPA rewrite CloudFront Function, and no-cache rules for the app shell
  and service worker.
- Manage the infrastructure with **CloudFormation** in `infra/cloudformation`:
  - `bootstrap.yml`: an admin applies it once per account. It holds the OIDC provider, a
    per-environment deploy role, and a per-environment CloudFormation execution role.
  - `web.yml`: CI deploys it, one stack per environment.
- **Authentication:** GitHub Actions authenticates with **OIDC**. Each role trusts only its own
  GitHub environment's `sub` claim. The deploy roles can only create change sets for their own
  stack, pass their own execution role, upload to their own bucket, and invalidate CloudFront.
- **Promotion:** `dev` deploys on every push to `main`. `prod` deploys on a release-please
  release, after `dev` succeeds, gated by a required reviewer on the `prod` GitHub environment.
- **Linting:** CI runs `cfn-lint` and `checkov`. Accepted deviations (no WAF, no access logs,
  no S3 access logging, default certificate TLS policy) are documented inline.

## Alternatives considered

- **GitHub Pages:** free, but it has no environments on separate origins, no header control
  (CSP/HSTS), and it is not in the AWS account we will grow into.
- **Amplify Hosting:** less to write, but less control over headers, caching and IAM, and
  harder to extend with the sync API.
- **CDK / Terraform:** good options. CloudFormation was requested, needs no extra toolchain or
  state backend, and these templates can be ported later.

## Consequences

- Hosting costs are tiny, and there is no server to patch.
- Each origin has its own IndexedDB, so `dev` and `prod` data are separate on a device.
- When the sync API arrives, add an API stack (e.g. ECS Fargate or Lambda behind API Gateway)
  to the same per-environment pattern and roles.
