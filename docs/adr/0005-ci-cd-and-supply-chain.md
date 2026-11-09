# 5. CI/CD and supply-chain security

- Status: Accepted
- Date: 2026-11-07

## Context

We want fast feedback on PRs, reproducible releases, and verifiable artifacts with no long-lived
cloud credentials.

## Decision

- GitHub Actions with SHA-pinned actions, least-privilege tokens, concurrency and timeouts.
- Required checks via a repository ruleset; a single aggregated `CI OK` check decouples rules
  from job names.
- Conventional Commits and release-please for SemVer and changelogs.
- Release artifacts: a signed multi-arch GHCR image (SBOM, SLSA provenance, cosign keyless via
  OIDC) for self-hosting, and the static PWA deployed to GitHub Pages behind the `github-pages`
  environment.
- Dependabot for npm, Actions and Docker with a 7-day cooldown; CodeQL, dependency review,
  gitleaks, actionlint and zizmor as security gates.

## Consequences

- Hosting the PWA on Pages costs nothing and fits the local-first design (static files only).
- When the sync API is introduced, a container deploy target (e.g. Cloud Run or Fly.io via OIDC)
  will be added as a separate environment with approval gates.
