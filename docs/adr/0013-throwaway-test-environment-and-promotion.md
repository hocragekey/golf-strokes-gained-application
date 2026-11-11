# 13. Throwaway test environment and build promotion

- Status: accepted
- Date: 2026-11-11

## Context

`main` deployed straight to a long-lived `dev` environment and prod deployed a release-please tag,
rebuilt from source. Nothing exercised the real AWS stack (CloudFront, API Gateway authorizer,
Lambda, DynamoDB) before users did; two earlier deploy failures (IAM capabilities, API Gateway
tagging) only surfaced after merge. The owner wants a prod and a test hostname, the test
environment torn down after every run rather than kept live, and promotion gated by automated
browser tests in CI.

## Decision

- Build once per push to `main` and pass the artifact through every stage; prod gets exactly the
  bytes that were tested.
- The `test` environment is created from nothing for each run (web and API stacks, bucket, table),
  tested with the existing Playwright suite over HTTPS, then fully deleted, including the
  CloudFront distribution, whatever the result. The owner chose full teardown over keeping an
  empty distribution, accepting roughly 20-40 minutes per run.
- One fixed hostname (`test.<domain>`) serialised by a GitHub Actions concurrency group, instead of
  per-run hostnames, so Google sign-in can list it as an authorised origin.
- Passing builds are promoted to prod behind the `prod` environment's required reviewer.
- A nightly job deletes anything a cancelled run left behind.
- Test gets its own deploy and CloudFormation execution roles, scoped to `*-test` resources; only
  it may delete stacks, the site bucket and the table.

## Consequences

- Every merge costs a test cycle of 20-40 minutes and a few cents.
- Infra regressions are caught before prod, not after.
- `dev` is no longer deployed; its stacks remain until removed by hand.
- Real Google sign-in is not automated; Playwright checks that the API refuses requests without a
  token.
