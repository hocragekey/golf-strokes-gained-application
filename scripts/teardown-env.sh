#!/usr/bin/env bash
# Deletes every AWS resource of a throwaway environment (default: test): the web and sync API
# stacks, plus the site bucket and table they retain on delete. Safe to re-run; refuses prod.
#
# Needs: aws CLI with that environment's deploy role. EXECUTION_ROLE_ARN (optional) is the
# CloudFormation role used for the deletes.
set -euo pipefail

ENVIRONMENT="${1:-test}"
APP="${APP:-golf-sg}"
if [[ "$ENVIRONMENT" == prod ]]; then
  echo "Refusing to tear down prod" >&2
  exit 1
fi

account="$(aws sts get-caller-identity --query Account --output text)"
web="$APP-web-$ENVIRONMENT"
api="$APP-api-$ENVIRONMENT"
bucket="$APP-web-$ENVIRONMENT-$account"
table="$APP-api-$ENVIRONMENT"
role=()
[[ -n "${EXECUTION_ROLE_ARN:-}" ]] && role=(--role-arn "$EXECUTION_ROLE_ARN")

failures() {
  aws cloudformation describe-stack-events --stack-name "$1" --max-items 30 --output table \
    --query "StackEvents[?contains(ResourceStatus, 'FAILED')].[Timestamp,LogicalResourceId,ResourceStatusReason]" || true
}

for stack in "$web" "$api"; do
  if aws cloudformation describe-stacks --stack-name "$stack" >/dev/null 2>&1; then
    echo "Deleting stack $stack"
    aws cloudformation delete-stack --stack-name "$stack" "${role[@]}"
  fi
done
# CloudFront has to disable and then delete the distribution, which takes most of the time.
for stack in "$web" "$api"; do
  aws cloudformation wait stack-delete-complete --stack-name "$stack" || {
    failures "$stack"
    exit 1
  }
done

if aws s3api head-bucket --bucket "$bucket" 2>/dev/null; then
  echo "Deleting bucket $bucket"
  while :; do
    batch="$(aws s3api list-object-versions --bucket "$bucket" --max-items 1000 --output json \
      --query '{Objects: [Versions, DeleteMarkers][][].{Key: Key, VersionId: VersionId}, Quiet: `true`}')"
    [[ "$(jq '.Objects | length' <<<"$batch")" == 0 ]] && break
    aws s3api delete-objects --bucket "$bucket" --delete "$batch" >/dev/null
  done
  aws s3api delete-bucket --bucket "$bucket"
fi

if aws dynamodb describe-table --table-name "$table" >/dev/null 2>&1; then
  echo "Deleting table $table"
  aws dynamodb delete-table --table-name "$table" >/dev/null
  aws dynamodb wait table-not-exists --table-name "$table"
fi

echo "Environment $ENVIRONMENT is gone"
