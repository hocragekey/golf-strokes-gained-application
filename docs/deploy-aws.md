# Deploying to AWS

The web app is a static, local-first PWA. Each person's rounds live in their own browser, so
hosting is S3 + CloudFront plus the optional serverless sync API. Every push to `main` goes
through one pipeline (ADR 0013):

```
build once ──▶ test environment (created from scratch) ──▶ Playwright over HTTPS ──▶ tear down
                                                                     │ pass
                                                                     ▼
                                                 promote the same build to prod
```

| Environment | Stacks                                 | Lifetime                       | Gate                        |
| ----------- | -------------------------------------- | ------------------------------ | --------------------------- |
| `test`      | `golf-sg-web-test`, `golf-sg-api-test` | one pipeline run, then deleted | none                        |
| `prod`      | `golf-sg-web-prod`, `golf-sg-api-prod` | permanent                      | required reviewer in GitHub |
| `dev`       | `golf-sg-web-dev`, `golf-sg-api-dev`   | legacy, no longer deployed     | none                        |

```
GitHub Actions ──OIDC──▶ golf-sg-deploy-<env> role ──passes──▶ golf-sg-cfn-execution-<env> role
      │                         │                                   │
      │ s3 sync / invalidate    │ CloudFormation change set         ▼
      ▼                         ▼                          S3 (private) ◀─OAC─ CloudFront ◀── users
```

- `infra/cloudformation/bootstrap.yml`: deployed **once per account** by an admin. It creates
  the GitHub OIDC provider, one deploy role per environment (trusted only for this repo's
  `<env>` GitHub environment), and a CloudFormation execution role per environment, so a `dev` change set can never modify `prod` resources. No AWS keys are ever stored in GitHub.
- `infra/cloudformation/web.yml`: one stack per environment, deployed by CI. It contains:
  - a private, encrypted, versioned S3 bucket that only accepts TLS
  - CloudFront with origin access control, HTTP/2 + HTTP/3, and redirect to HTTPS
  - security headers (CSP, HSTS, frame and referrer policies)
  - an SPA rewrite function
  - a no-cache rule for `index.html` and `sw.js` so phones pick up new releases
  - optionally, a custom domain with Route 53 aliases

## Sign-in and sync API (optional)

Google sign-in and sync (PRD §5.7, ADR 0011) ship only when `config/app.json` has a
`googleClientId`. The client ID is public; it is not a secret. When it is set, the deploy job also:

1. builds `apps/sync` and uploads the Lambda bundle to the bootstrap stack's artifact bucket
   (`golf-sg-artifacts-<account>-<region>/<env>/sync-<sha>.zip`);
2. deploys `infra/cloudformation/api.yml` as `golf-sg-api-<env>`: an API Gateway HTTP API with a
   Google JWT authorizer, the sync Lambda, and a DynamoDB table (point-in-time recovery on; deletion
   protection in prod);
3. passes the API domain to `web.yml`, which adds an uncached `/api/*` CloudFront behavior so the
   browser calls the API on the same origin;
4. smoke-tests that `/api/sync` without a token returns 401.

The Google OAuth client must list each site origin (e.g. the CloudFront URL and
`http://localhost:5173`) under **Authorized JavaScript origins**. The deploy roles need the API
permissions added to `bootstrap.yml`, so re-run `./scripts/aws-bootstrap.sh` once after upgrading.

## Quick setup (recommended)

With short-lived admin credentials for the account (`aws sso login` or an STS session) and `gh`
authenticated as a repo admin:

```bash
./scripts/aws-bootstrap.sh   # env overrides: AWS_REGION, REPO, PROD_REVIEWER
```

It runs steps 1–3 below and is safe to re-run. Then follow step 4.

## One-time setup (manual equivalent)

Use `us-east-1`. CloudFront certificates must live there, and keeping everything in one
region is simplest.

1. **Bootstrap the account.** You need admin credentials only for this step.

   ```bash
   # Reuse the GitHub OIDC provider if the account already has one:
   aws iam list-open-id-connect-providers
   aws cloudformation deploy --region us-east-1 \
     --stack-name golf-sg-bootstrap \
     --template-file infra/cloudformation/bootstrap.yml \
     --capabilities CAPABILITY_NAMED_IAM
     # add: --parameter-overrides ExistingOidcProviderArn=arn:aws:iam::<acct>:oidc-provider/token.actions.githubusercontent.com
     # for a fork or another repo, also override GitHubOwner, GitHubRepo, GitHubOwnerId, GitHubRepoId
   aws cloudformation describe-stacks --region us-east-1 --stack-name golf-sg-bootstrap \
     --query 'Stacks[0].Outputs' --output table
   ```

   The roles trust the OIDC `sub` claim exactly. This repo uses GitHub's immutable subject
   (`repo:hocragekey@2671490/golf-strokes-gained-application@1449035641:environment:<env>`), so the
   template defaults `GitHubOwnerId`/`GitHubRepoId` to those IDs. Check what a repo uses with
   `gh api repos/<owner>/<repo>/actions/oidc/customization/sub`: if `use_immutable_subject` is
   true, pass the IDs from `gh api repos/<owner>/<repo> --jq '.owner.id, .id'`; otherwise pass
   both as empty strings for the classic `repo:<owner>/<repo>` subject. A mismatch fails deploys
   with `Not authorized to perform sts:AssumeRoleWithWebIdentity`.

2. **Create the GitHub environments and variables.** Use the outputs from step 1.

   ```bash
   repo=hocragekey/golf-strokes-gained-application
   gh api -X PUT repos/$repo/environments/dev
   gh api -X PUT repos/$repo/environments/prod
   gh variable set AWS_DEPLOY_ROLE_ARN        --repo $repo --env dev  --body <DevDeployRoleArn>
   gh variable set AWS_DEPLOY_ROLE_ARN        --repo $repo --env prod --body <ProdDeployRoleArn>
   gh variable set AWS_CFN_EXECUTION_ROLE_ARN --repo $repo --env dev  --body <DevCfnExecutionRoleArn>
   gh variable set AWS_CFN_EXECUTION_ROLE_ARN --repo $repo --env prod --body <ProdCfnExecutionRoleArn>
   gh variable set AWS_REGION                 --repo $repo --body us-east-1
   gh variable set AWS_DEPLOY_ENABLED         --repo $repo --body true
   ```

3. **Protect `prod`.** In Settings → Environments → `prod`, add yourself as a required
   reviewer and restrict deployment branches to `main`. Restrict `dev` to `main` as well:
   the deploy role trusts any workflow run that targets the environment.

4. **Ship.** Push to `main` (or run the Release workflow manually) and `dev` deploys. Merging a
   release-please PR deploys `prod` once you approve it. Each environment's URL appears on its
   GitHub deployment and in the `SiteUrl` stack output.

## Test environment and promotion

`.github/workflows/release.yml` runs on every push to `main`:

1. **Build** (`build-release.yml`): the web app and the sync Lambda are built once and uploaded as
   the `release-<sha>` artifact (kept 90 days).
2. **Test environment** (`test-env.yml`): clears anything a crashed run left behind, deploys the
   artifact to brand-new `test` stacks (CloudFront, S3, API Gateway, Lambda, DynamoDB), runs the
   whole Playwright suite against the live HTTPS URL (`E2E_BASE_URL`), then runs
   `scripts/teardown-env.sh test`, pass or fail. A full cycle takes roughly 20-40 minutes, mostly
   CloudFront creating and deleting the distribution.
3. **Promote to prod** (`deploy-web.yml`): only after the test job passes, the same artifact is
   deployed to prod. The `prod` GitHub environment's required reviewer approves it.

Only one run holds the test environment at a time (concurrency group `test-environment`). A
newer push waits; if several queue up, GitHub keeps only the newest waiting run, which contains
the earlier commits. `test-env-cleanup.yml` runs nightly in the same group and deletes anything a
cancelled run left behind.

**Rollback:** re-run the `Promote to prod` job of an earlier Release run; it redeploys that run's
artifact (while it is retained).

## Custom domain

Prod and test get fixed hostnames with one certificate. With a Route 53 public hosted zone for the
domain (created automatically when the domain is registered in Route 53), run the bootstrap with
`DOMAIN`:

```bash
DOMAIN=example.com ./scripts/aws-bootstrap.sh            # prod: example.com, test: test.example.com
DOMAIN=example.com PROD_HOST=golf.example.com ./scripts/aws-bootstrap.sh
```

It deploys `infra/cloudformation/domain.yml` (a DNS-validated ACM certificate in us-east-1 for both
hostnames) and sets `DOMAIN_NAME`, `ACM_CERTIFICATE_ARN` and `HOSTED_ZONE_ID` on the `test` and
`prod` GitHub environments; the web stacks then add the Route 53 alias records. Add both
`https://` origins to the Google OAuth client.

## Operations

- **Rollback.** Re-run the `Promote to prod` job of an earlier Release workflow run. Hashed
  assets are never deleted, so clients on any recent build keep working.
- **Template changes** go through PRs like code. CI runs `cfn-lint` and `checkov` on
  `infra/cloudformation`. Any skipped checkov rule carries a justification in the template's
  `Metadata`.
- **Cost.** It is S3 storage plus CloudFront requests and transfer, so for a handful of users
  it should stay within or near the AWS free tier. Add an AWS Budget alert on the account
  anyway.
- **Teardown.** Delete the `golf-sg-web-<env>` and `golf-sg-api-<env>` stacks (prod's table has
  deletion protection; turn it off first). The buckets are retained (`DeletionPolicy:
Retain`), so empty and delete them afterwards. Delete `golf-sg-bootstrap` last.
