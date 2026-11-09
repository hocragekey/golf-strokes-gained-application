# Engineering standards

## Branching and merging

- Trunk-based: short-lived branches off `main`, squash-merged via PR. Linear history.
- `main` is protected by the ruleset in [`.github/rulesets/main.json`](../.github/rulesets/main.json):
  no direct pushes, no force-pushes or deletion, required checks, resolved conversations, and
  CodeQL high-severity alerts block merging.

Apply or update the ruleset (repo admin):

```bash
gh api -X POST repos/hocragekey/golf-strokes-gained-application/rulesets \
  --input .github/rulesets/main.json
```

## Commits and versioning

- Conventional Commits for commits and PR titles; SemVer derived from them.
- [release-please](https://github.com/googleapis/release-please) keeps a release PR open with
  the changelog and version bump. Merging it tags the release and triggers delivery.

## CI (every PR, push to `main`, merge queue)

| Workflow       | Jobs                                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ci.yml`       | format check, lint, typecheck, unit tests with coverage gate, build; Playwright E2E incl. offline; Docker build + smoke test; aggregated `CI OK` |
| `security.yml` | dependency review (PRs), gitleaks secret scan, actionlint + zizmor workflow audit; weekly schedule                                               |
| `codeql.yml`   | CodeQL `security-extended` for TypeScript and Actions; weekly schedule                                                                           |
| `pr-title.yml` | Conventional Commit PR title                                                                                                                     |

Rules for workflows: actions pinned by SHA with a version comment, top-level
`permissions: contents: read`, per-job escalation only, `persist-credentials: false`,
concurrency groups that cancel superseded PR runs, job timeouts, and no untrusted code in
`pull_request_target`.

## CD (`release.yml`)

On a release-please release:

1. **Container image** to GHCR: multi-arch (amd64/arm64), BuildKit SBOM and max-mode
   provenance, keyless cosign signature and GitHub build-provenance attestation, all via OIDC
   (no long-lived credentials).
2. **PWA to GitHub Pages** through the `github-pages` environment. Add required reviewers to
   that environment to gate production deploys.

`workflow_dispatch` re-deploys Pages from `main` without cutting a release.

One-time setup (repo admin): Settings, then Pages, then Source: **GitHub Actions**.

## Testing pyramid

- **Unit** (`packages/shared`): baseline interpolation, validation, SG engine invariants, stats.
- **Component** (`apps/web`): pages against a real Dexie store on `fake-indexeddb`.
- **API** (`apps/api`): Fastify `inject` for health checks, static hosting and SPA fallback.
- **E2E** (`e2e`): Playwright on the production build, including a service-worker offline reload.

## Runtime and dependencies

- Node version in `.nvmrc`, pnpm pinned via `packageManager`; lockfile is authoritative
  (`--frozen-lockfile` in CI). Install scripts are allow-listed in `pnpm-workspace.yaml`.
- Container: digest-pinned base, non-root user, read-only root filesystem, no capabilities.
