# Security Policy

## Supported versions

Only the latest release receives fixes.

## Reporting a vulnerability

Please **do not open a public issue**. Use
[GitHub private vulnerability reporting](https://github.com/hocragekey/golf-strokes-gained-application/security/advisories/new).
You'll get an acknowledgement within 3 business days and a fix or mitigation plan within 30 days
for confirmed issues.

## Supply chain

- Every GitHub Action is pinned to a full commit SHA; Dependabot proposes updates weekly.
- Workflows default to `contents: read` and grant extra permissions per job.
- Deploys to AWS use GitHub OIDC with per-environment roles; no AWS keys are stored in GitHub.

## Data

Scorecard data is stored only on the user's device. No telemetry is collected.
