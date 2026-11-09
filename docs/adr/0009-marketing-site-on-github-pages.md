# 9. Marketing and architecture site on GitHub Pages

- Status: Accepted
- Date: 2026-11-09
- Relates to: [ADR 0007](0007-aws-static-hosting.md) (the app stays on AWS)

## Context

We want a public landing page that explains the product, the card notation, the roadmap and the
architecture, so the design can be reviewed and shared before the app is deployed to AWS. ADR 0007
moved the _app_ off GitHub Pages because Pages has no per-environment origins or header control.
None of those concerns apply to a static, data-free brochure page.

## Decision

- The site lives in `site/` as a single self-contained `index.html` (inline CSS, no JavaScript,
  no third-party requests, no build step).
- `.github/workflows/pages.yml` publishes `site/` to GitHub Pages on pushes to `main` that touch
  it, or on manual dispatch. It uses SHA-pinned official Pages actions, least-privilege job
  permissions and the `github-pages` environment.
- The app remains hosted on AWS (dev/prod). The site links to the repository and docs until a
  public app URL exists.

## Consequences

- Zero cost and no infrastructure to manage for the landing page.
- The repository admin must set Settings → Pages → Source to **GitHub Actions** once.
- Architecture content on the page is a summary; `docs/technical-design.md` stays the source of
  truth and the page must be updated when the architecture changes.
