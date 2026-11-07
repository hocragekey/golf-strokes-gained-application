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
- Release images on GHCR are built with SBOM and SLSA provenance and signed keylessly with
  Sigstore cosign. Verify with:

```bash
cosign verify ghcr.io/hocragekey/golf-strokes-gained-application:<version> \
  --certificate-identity-regexp 'https://github.com/hocragekey/golf-strokes-gained-application/.github/workflows/release.yml@.*' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
gh attestation verify oci://ghcr.io/hocragekey/golf-strokes-gained-application:<version> \
  --repo hocragekey/golf-strokes-gained-application
```

## Data

Scorecard data is stored only on the user's device. No telemetry is collected.
