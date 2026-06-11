#!/usr/bin/env bash
# Deploy Wobblio to AWS.
# Covers: CDK stacks (5 stacks), database migrations, webapp build + deployment.
#
# Profile: reuterAdmin  |  Region: eu-west-1  |  STAGE: prod (default)
#
# Pre-requisites (one-time, see DEPLOY-AWS.md):
#   1. shared-infra deployed + wobblio onboarded (onboard-app.sh wobblio wobblio_prod)
#   2. AWS environment bootstrapped (scripts/bootstrap-aws.sh)
#   3. CDK bootstrapped in eu-west-1 AND us-east-1
#   4. Route53 hosted zone for wobblio.com exists
#
# Usage:
#   scripts/deploy-aws.sh                    # deploy all (prod)
#   scripts/deploy-aws.sh --stage dev        # deploy dev stage
#   scripts/deploy-aws.sh --skip-webapp      # skip webapp build + deploy
#   scripts/deploy-aws.sh --skip-migrations  # skip database migrations
#   STAGE=prod scripts/deploy-aws.sh         # env var override

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
INFRA_DIR="$REPO_ROOT/Source/infra"
BACKEND_DIR="$REPO_ROOT/Source/backend"
WEBAPP_DIR="$REPO_ROOT/Source/webapp"

# ── Defaults ──────────────────────────────────────────────────────────────────
AWS_PROFILE="${AWS_PROFILE:-reuterAdmin}"
AWS_REGION="${AWS_REGION:-eu-west-1}"
STAGE="${STAGE:-prod}"
SKIP_WEBAPP=0
SKIP_MIGRATIONS=0

# ── Arg parsing ───────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --stage)         STAGE="$2"; shift 2 ;;
    --stage=*)       STAGE="${1#*=}"; shift ;;
    --skip-webapp)   SKIP_WEBAPP=1; shift ;;
    --skip-migrations) SKIP_MIGRATIONS=1; shift ;;
    -h|--help)
      sed -n '2,16p' "$0"; exit 0 ;;
    *)
      echo "Unknown argument: $1. Use --help for usage."; exit 1 ;;
  esac
done

export AWS_PROFILE
export AWS_DEFAULT_REGION="$AWS_REGION"
export CDK_DEFAULT_REGION="$AWS_REGION"
export STAGE

# ── Helpers ───────────────────────────────────────────────────────────────────
bold()  { printf '\033[1m%s\033[0m\n' "$*"; }
step()  { printf '\n\033[34m▶ %s\033[0m\n' "$*"; }
ok()    { printf '  \033[32m✓\033[0m %s\n' "$*"; }
info()  { printf '  \033[34m→\033[0m %s\n' "$*"; }
warn()  { printf '  \033[33m⚠\033[0m %s\n' "$*"; }
fail()  { printf '\033[31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

START_TIME=$(date +%s)

# ── Pre-flight checks ─────────────────────────────────────────────────────────
bold "Wobblio AWS Deployment"
info "Stage:   $STAGE"
info "Profile: $AWS_PROFILE"
info "Region:  $AWS_REGION"

step "Pre-flight checks"

for cmd in aws node npm npx jq; do
  command -v "$cmd" >/dev/null 2>&1 || fail "'$cmd' not found on PATH"
done
ok "Required tools present"

aws sts get-caller-identity --profile "$AWS_PROFILE" > /dev/null 2>&1 \
  || fail "AWS credentials not valid for profile '$AWS_PROFILE'. Run: aws configure --profile $AWS_PROFILE"
ok "AWS credentials valid"

# Verify shared DB SSM param exists
aws ssm get-parameter \
  --name /shared/db/wobblio/secret-arn \
  --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  > /dev/null 2>&1 \
  || fail "/shared/db/wobblio/secret-arn not found. Run onboard-app.sh wobblio wobblio_prod from shared-infra first."
ok "Shared DB credentials present"

# Verify Route53 hosted zone
HZ_ID=$(aws route53 list-hosted-zones \
  --profile "$AWS_PROFILE" \
  --query "HostedZones[?Name=='wobblio.com.'].Id" \
  --output text 2>/dev/null || echo "")
[[ -n "$HZ_ID" ]] || fail "Route53 hosted zone for wobblio.com not found. Create it first."
ok "Route53 hosted zone: $HZ_ID"

# ── Install dependencies ──────────────────────────────────────────────────────
step "Install dependencies"

for dir in "$BACKEND_DIR" "$INFRA_DIR"; do
  if [[ ! -d "$dir/node_modules" ]]; then
    info "npm install in $(basename $dir)..."
    npm ci --silent --prefix "$dir"
  fi
  ok "$(basename $dir) dependencies ready"
done

if [[ $SKIP_WEBAPP -eq 0 && ! -d "$WEBAPP_DIR/node_modules" ]]; then
  info "npm install in webapp..."
  npm ci --silent --prefix "$WEBAPP_DIR"
fi
ok "webapp dependencies ready"

# ── Validation gates ──────────────────────────────────────────────────────────
step "Validation gates"

info "Hexagonal architecture validator..."
(cd "$BACKEND_DIR" && npm run skill:hexagonal-architecture-validator --silent)
ok "Hexagonal validator: clean"

info "Backend unit tests..."
(cd "$BACKEND_DIR" && npm run test:unit --silent)
ok "Backend unit tests: passed"

info "CDK synth (cdk-nag gate)..."
(cd "$INFRA_DIR" && STAGE="$STAGE" npm run cdk:synth -- --quiet)
ok "CDK synth: passed"

# ── CDK deploy: WobblioDbStack ─────────────────────────────────────────────────
step "Deploy WobblioDbStack-${STAGE} (KMS key)"
(cd "$INFRA_DIR" && npx cdk deploy "WobblioDbStack-${STAGE}" \
  --profile "$AWS_PROFILE" --require-approval never)
ok "WobblioDbStack-${STAGE} deployed"

# ── CDK deploy: WobblioAuthStack ──────────────────────────────────────────────
step "Deploy WobblioAuthStack-${STAGE} (Cognito)"
(cd "$INFRA_DIR" && npx cdk deploy "WobblioAuthStack-${STAGE}" \
  --profile "$AWS_PROFILE" --require-approval never)
ok "WobblioAuthStack-${STAGE} deployed"

# ── CDK deploy: WobblioAppStack ───────────────────────────────────────────────
step "Deploy WobblioAppStack-${STAGE} (Lambda fleet + API Gateway)"
(cd "$INFRA_DIR" && npx cdk deploy "WobblioAppStack-${STAGE}" \
  --profile "$AWS_PROFILE" --require-approval never)
ok "WobblioAppStack-${STAGE} deployed"

# ── Database migrations ───────────────────────────────────────────────────────
if [[ $SKIP_MIGRATIONS -eq 0 ]]; then
  step "Database migrations"

  SECRET_ARN=$(aws ssm get-parameter \
    --name /shared/db/wobblio/secret-arn \
    --profile "$AWS_PROFILE" --region "$AWS_REGION" \
    --query Parameter.Value --output text)

  SECRET_JSON=$(aws secretsmanager get-secret-value \
    --secret-id "$SECRET_ARN" \
    --profile "$AWS_PROFILE" --region "$AWS_REGION" \
    --query SecretString --output text)

  DB_USER=$(echo "$SECRET_JSON" | jq -r .username)
  DB_PASS=$(echo "$SECRET_JSON" | jq -r .password)
  DB_HOST=$(echo "$SECRET_JSON" | jq -r .host)
  DB_PORT=$(echo "$SECRET_JSON" | jq -r .port)
  DB_NAME=$(echo "$SECRET_JSON" | jq -r .dbname)

  export DATABASE_URL="postgres://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=no-verify"
  info "Running migrations against $DB_HOST/$DB_NAME..."

  (cd "$INFRA_DIR" && npm run migrate:up)
  ok "Migrations applied"
else
  warn "Skipping database migrations (--skip-migrations)"
fi

# ── Webapp build + deploy ─────────────────────────────────────────────────────
if [[ $SKIP_WEBAPP -eq 0 ]]; then
  step "Webapp build"

  # Write production environment file
  cat > "$WEBAPP_DIR/.env.production" <<EOF
NEXT_PUBLIC_API_BASE_URL=https://api.wobblio.com
NEXT_PUBLIC_SITE_URL=https://app.wobblio.com
EOF
  info "Written .env.production"

  info "Building Next.js static export..."
  (cd "$WEBAPP_DIR" && npm run build)
  ok "Webapp built → Source/webapp/out/"

  step "Deploy WobblioWebCertStack-${STAGE} (ACM cert, us-east-1)"
  (cd "$INFRA_DIR" && npx cdk deploy "WobblioWebCertStack-${STAGE}" \
    --profile "$AWS_PROFILE" --require-approval never)
  ok "WobblioWebCertStack-${STAGE} deployed"

  step "Deploy WobblioWebStack-${STAGE} (S3 + CloudFront + Route53)"
  (cd "$INFRA_DIR" && npx cdk deploy "WobblioWebStack-${STAGE}" \
    --profile "$AWS_PROFILE" --require-approval never)
  ok "WobblioWebStack-${STAGE} deployed"
else
  warn "Skipping webapp build and WobblioWebStack deploy (--skip-webapp)"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
ELAPSED=$(( $(date +%s) - START_TIME ))

printf '\n'
bold "Deployment complete in ${ELAPSED}s"
printf '\n'
printf '  %-30s %s\n' "Landing page:"     "https://app.wobblio.com"
printf '  %-30s %s\n' "API base:"         "https://api.wobblio.com"
printf '  %-30s %s\n' "Waitlist status:"  "https://api.wobblio.com/waitlist/status"
printf '\n'
info "Smoke test:"
info "  curl -s https://api.wobblio.com/waitlist/status"
info "  curl -sI https://app.wobblio.com | grep HTTP/"
printf '\n'
warn "Action required: confirm SNS subscription email sent to antonioreuter@gmail.com"
warn "DNS/ACM validation may take up to 30 minutes on first deploy"
