#!/usr/bin/env bash
# One-time AWS + GitHub setup for the test/prod deployments. See docs/deploy-aws.md.
#
# Optional custom domain: DOMAIN=example.com (a Route 53 public zone must exist for it).
# Prod is served at PROD_HOST (default: DOMAIN), the test environment at TEST_HOST
# (default: test.DOMAIN).
#
# Needs: aws CLI v2 with short-lived admin credentials for the target account (SSO or STS),
# gh CLI authenticated as a repository admin. Safe to re-run.
set -euo pipefail

REPO="${REPO:-hocragekey/golf-strokes-gained-application}"
REGION="${AWS_REGION:-us-east-1}"
STACK="${STACK:-golf-sg-bootstrap}"
REVIEWER="${PROD_REVIEWER:-}"
DOMAIN="${DOMAIN:-}"
PROD_HOST="${PROD_HOST:-$DOMAIN}"
TEST_HOST="${TEST_HOST:-${DOMAIN:+test.$DOMAIN}}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() { printf '\n==> %s\n' "$*"; }

command -v aws >/dev/null || { echo "aws CLI not found" >&2; exit 1; }
command -v gh >/dev/null || { echo "gh CLI not found" >&2; exit 1; }

log "Checking credentials"
account="$(aws sts get-caller-identity --query Account --output text)"
echo "AWS account: $account  region: $REGION  repo: $REPO"
gh api "repos/$REPO" --jq '.permissions.admin' | grep -qx true ||
  { echo "gh user needs admin on $REPO" >&2; exit 1; }
# Keep existing prod reviewers on re-runs; otherwise default to PROD_REVIEWER or the gh user
# (the repo owner may be an organization, which can't be a reviewer).
prod_reviewers="$(gh api "repos/$REPO/environments/prod" \
  --jq '[.protection_rules[]? | select(.type == "required_reviewers") | .reviewers[]
         | {type, id: .reviewer.id}]' 2>/dev/null || echo '[]')"
if [[ -n "$REVIEWER" || "$prod_reviewers" == "[]" ]]; then
  REVIEWER="${REVIEWER:-$(gh api user --jq .login)}"
  prod_reviewers="[{\"type\":\"User\",\"id\":$(gh api "users/$REVIEWER" --jq .id)}]"
fi

log "Deploying $STACK"
overrides=("GitHubOwner=${REPO%%/*}" "GitHubRepo=${REPO##*/}")
# Deploy roles trust the exact OIDC subject GitHub issues for this repo (see docs/deploy-aws.md).
immutable_sub="$(gh api "repos/$REPO/actions/oidc/customization/sub" --jq .use_immutable_subject)"
if [[ "$immutable_sub" == true ]]; then
  ids="$(gh api "repos/$REPO" --jq '"\(.owner.id) \(.id)"')"
  overrides+=("GitHubOwnerId=${ids% *}" "GitHubRepoId=${ids#* }")
else
  overrides+=("GitHubOwnerId=" "GitHubRepoId=")
fi
existing="$(aws iam list-open-id-connect-providers --output text \
  --query "OpenIDConnectProviderList[?ends_with(Arn, '/token.actions.githubusercontent.com')].Arn | [0]")"
# Reuse the account's GitHub OIDC provider unless this stack created it.
owned="$(aws cloudformation describe-stack-resource --region "$REGION" --stack-name "$STACK" \
  --logical-resource-id GitHubOidcProvider --query StackResourceDetail.PhysicalResourceId \
  --output text 2>/dev/null || true)"
if [[ -n "$existing" && "$existing" != "None" && "$existing" != "$owned" ]]; then
  echo "Reusing OIDC provider $existing"
  overrides+=("ExistingOidcProviderArn=$existing")
fi
aws cloudformation deploy --region "$REGION" --stack-name "$STACK" \
  --template-file "$ROOT/infra/cloudformation/bootstrap.yml" \
  --capabilities CAPABILITY_NAMED_IAM --no-fail-on-empty-changeset \
  --parameter-overrides "${overrides[@]}"

output() {
  aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}

for env in dev test prod; do
  Env="${env^}"
  log "Configuring GitHub environment $env"
  if [[ "$env" == prod ]]; then
    body="{\"reviewers\":$prod_reviewers,\"deployment_branch_policy\":{\"protected_branches\":false,\"custom_branch_policies\":true}}"
  else
    body='{"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}'
  fi
  gh api -X PUT "repos/$REPO/environments/$env" --input - <<<"$body" >/dev/null
  if ! gh api "repos/$REPO/environments/$env/deployment-branch-policies" \
    --jq '.branch_policies[].name' | grep -qx main; then
    gh api -X POST "repos/$REPO/environments/$env/deployment-branch-policies" \
      -f name=main -f type=branch >/dev/null
  fi
  gh variable set AWS_DEPLOY_ROLE_ARN --repo "$REPO" --env "$env" --body "$(output "${Env}DeployRoleArn")"
  gh variable set AWS_CFN_EXECUTION_ROLE_ARN --repo "$REPO" --env "$env" \
    --body "$(output "${Env}CfnExecutionRoleArn")"
done

if [[ -n "$DOMAIN" ]]; then
  log "Certificate for $PROD_HOST and $TEST_HOST"
  zone="$(aws route53 list-hosted-zones-by-name --dns-name "$DOMAIN." --output text \
    --query "HostedZones[?Name=='$DOMAIN.' && !Config.PrivateZone].Id | [0]")"
  [[ -n "$zone" && "$zone" != None ]] || { echo "No public Route 53 zone for $DOMAIN" >&2; exit 1; }
  zone="${zone##*/}"
  aws cloudformation deploy --region us-east-1 --stack-name golf-sg-domain \
    --template-file "$ROOT/infra/cloudformation/domain.yml" --no-fail-on-empty-changeset \
    --parameter-overrides "ProdDomainName=$PROD_HOST" "TestDomainName=$TEST_HOST" \
    "HostedZoneId=$zone"
  cert="$(aws cloudformation describe-stacks --region us-east-1 --stack-name golf-sg-domain \
    --query "Stacks[0].Outputs[?OutputKey=='CertificateArn'].OutputValue" --output text)"
  for env in test prod; do
    host="$PROD_HOST"
    [[ "$env" == test ]] && host="$TEST_HOST"
    gh variable set DOMAIN_NAME --repo "$REPO" --env "$env" --body "$host"
    gh variable set ACM_CERTIFICATE_ARN --repo "$REPO" --env "$env" --body "$cert"
    gh variable set HOSTED_ZONE_ID --repo "$REPO" --env "$env" --body "$zone"
  done
fi

log "Enabling deployments"
gh variable set AWS_REGION --repo "$REPO" --body "$REGION"
gh variable set AWS_DEPLOY_ENABLED --repo "$REPO" --body true

log "Done. Push to main (or re-run the Release workflow) to test and promote a build."
