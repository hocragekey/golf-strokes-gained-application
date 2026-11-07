# Deploying to AWS

The web app is a static, local-first PWA. Each person's rounds live in their own browser, so
hosting is just S3 + CloudFront and there is no server or database to run. There are two
environments:

| Environment | Stack              | Deploys when                                    | Gate                        |
| ----------- | ------------------ | ----------------------------------------------- | --------------------------- |
| `dev`       | `golf-sg-web-dev`  | every push to `main`                            | none                        |
| `prod`      | `golf-sg-web-prod` | a release-please release (after `dev` succeeds) | required reviewer in GitHub |

```
GitHub Actions ──OIDC──▶ golf-sg-deploy-<env> role ──passes──▶ golf-sg-cfn-execution-<env> role
      │                         │                                   │
      │ s3 sync / invalidate    │ CloudFormation change set         ▼
      ▼                         ▼                          S3 (private) ◀─OAC─ CloudFront ◀── users
```

- `infra/cloudformation/bootstrap.yml`: deployed **once per account** by an admin. It creates
  the GitHub OIDC provider, one deploy role per environment (trusted only for
  `repo:hocragekey/golf-strokes-gained-application:environment:<env>`), and a CloudFormation execution role per
  environment, so a `dev` change set can never modify `prod` resources. No AWS keys are ever stored in GitHub.
- `infra/cloudformation/web.yml`: one stack per environment, deployed by CI. It contains:
  - a private, encrypted, versioned S3 bucket that only accepts TLS
  - CloudFront with origin access control, HTTP/2 + HTTP/3, and redirect to HTTPS
  - security headers (CSP, HSTS, frame and referrer policies)
  - an SPA rewrite function
  - a no-cache rule for `index.html` and `sw.js` so phones pick up new releases
  - optionally, a custom domain with Route 53 aliases

## One-time setup

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
   aws cloudformation describe-stacks --region us-east-1 --stack-name golf-sg-bootstrap \
     --query 'Stacks[0].Outputs' --output table
   ```

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

## Custom domain (optional)

1. Request a DNS-validated ACM certificate in **us-east-1** for the hostname. For example, use
   `golf.example.com` for prod and `dev.golf.example.com` for dev.
2. Set environment variables on `dev` and/or `prod`:
   - `DOMAIN_NAME`
   - `ACM_CERTIFICATE_ARN`
   - `HOSTED_ZONE_ID`: optional; set it if the zone is in Route 53 so the alias records are
     created for you.
3. Redeploy. If DNS isn't hosted in Route 53, point a CNAME at the distribution domain.

## Operations

- **Rollback.** Re-run the `Deploy prod` job of an earlier Release workflow run. That
  redeploys that release's tag. Hashed assets are never deleted, so clients on any recent
  build keep working.
- **Template changes** go through PRs like code. CI runs `cfn-lint` and `checkov` on
  `infra/cloudformation`. Any skipped checkov rule carries a justification in the template's
  `Metadata`.
- **Cost.** It is S3 storage plus CloudFront requests and transfer, so for a handful of users
  it should stay within or near the AWS free tier. Add an AWS Budget alert on the account
  anyway.
- **Teardown.** Delete the `golf-sg-web-<env>` stacks. The buckets are retained (`DeletionPolicy:
Retain`), so empty and delete them afterwards. Delete `golf-sg-bootstrap` last.
