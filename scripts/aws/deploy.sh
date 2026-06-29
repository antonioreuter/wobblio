#!/usr/bin/env bash
# Deploy Wobblio to AWS.
# Covers: CDK stacks (7 stacks), database migrations, webapp build + deployment.
#
# Profile: reuterAdmin  |  Region: eu-west-1  |  STAGE: prod (default)
#
# Pre-requisites (one-time, see DEPLOY-AWS.md):
#   1. shared-infra deployed + wobblio onboarded (onboard-app.sh wobblio wobblio_prod)
#   2. AWS environment bootstrapped (scripts/aws/bootstrap.sh)
#   3. CDK bootstrapped in eu-west-1 AND us-east-1
#   4. Route53 hosted zone for wobblio.com exists
#
# Usage:
#   scripts/aws/deploy.sh                    # deploy all (prod)
#   scripts/aws/deploy.sh --stage dev        # deploy dev stage
#   scripts/aws/deploy.sh --skip-webapp      # skip webapp build + deploy
#   scripts/aws/deploy.sh --skip-migrations  # skip database migrations
#   STAGE=prod scripts/aws/deploy.sh         # env var override

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
INFRA_DIR="$REPO_ROOT/Source/infra"
BACKEND_DIR="$REPO_ROOT/Source/backend"
WEBAPP_DIR="$REPO_ROOT/Source/webapp"

# ── Defaults ──────────────────────────────────────────────────────────────────
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

# ── Helpers ───────────────────────────────────────────────────────────────────
bold()  { printf '\033[1m%s\033[0m\n' "$*"; }
step()  { printf '\n\033[34m▶ %s\033[0m\n' "$*"; }
ok()    { printf '  \033[32m✓\033[0m %s\n' "$*"; }
info()  { printf '  \033[34m→\033[0m %s\n' "$*"; }
warn()  { printf '  \033[33m⚠\033[0m %s\n' "$*"; }
fail()  { printf '\033[31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

# ── Load stage config ─────────────────────────────────────────────────────────
CONFIG_FILE="$REPO_ROOT/config/${STAGE}.env"
[[ -f "$CONFIG_FILE" ]] || fail "Config file not found: config/${STAGE}.env (valid stages: dev, prod)"
# shellcheck source=/dev/null
set -a; source "$CONFIG_FILE"; set +a
ok "Config loaded: config/${STAGE}.env"

# CLI args override config file
AWS_PROFILE="${AWS_PROFILE:-reuterAdmin}"
AWS_REGION="${AWS_REGION:-eu-west-1}"

export AWS_PROFILE
export AWS_DEFAULT_REGION="$AWS_REGION"
export CDK_DEFAULT_REGION="$AWS_REGION"
export STAGE

# Stage-aware shared-DB secret pointer. Prod uses the canonical name; every other
# stage uses an underscore-suffixed alias (e.g. /shared/db/wobblio_dev/secret-arn)
# so dev migrations never touch the prod database.
if [[ "$STAGE" == "prod" ]]; then
  DB_SECRET_PARAM="/shared/db/wobblio/secret-arn"
  DB_NAME_EXPECTED="wobblio"
  DB_OWNER_ROLE="wobblio_app"
  DB_RUNTIME_ROLE="wobblio_runtime"
else
  DB_SECRET_PARAM="/shared/db/wobblio_${STAGE}/secret-arn"
  DB_NAME_EXPECTED="wobblio_${STAGE}"
  DB_OWNER_ROLE="wobblio_${STAGE}_app"
  DB_RUNTIME_ROLE="wobblio_${STAGE}_runtime"
fi

START_TIME=$(date +%s)

# ── Pre-flight checks ─────────────────────────────────────────────────────────
bold "Wobblio AWS Deployment"
info "Stage:   $STAGE"
info "Profile: $AWS_PROFILE"
info "Region:  $AWS_REGION"

step "Pre-flight checks"

for cmd in aws node npm npx jq psql; do
  command -v "$cmd" >/dev/null 2>&1 || fail "'$cmd' not found on PATH"
done
ok "Required tools present"

aws sts get-caller-identity --profile "$AWS_PROFILE" > /dev/null 2>&1 \
  || fail "AWS credentials not valid for profile '$AWS_PROFILE'. Run: aws configure --profile $AWS_PROFILE"
ok "AWS credentials valid"

# Verify shared DB SSM param exists
aws ssm get-parameter \
  --name "$DB_SECRET_PARAM" \
  --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  > /dev/null 2>&1 \
  || fail "$DB_SECRET_PARAM not found. Run onboard-app.sh wobblio wobblio_${STAGE} from shared-infra first."
ok "Shared DB credentials present ($DB_SECRET_PARAM)"

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

# ── CDK deploy: WobblioConfigStack ─────────────────────────────────────────────
# Owns /wobblio/config/<stage>/* from config/config.<stage>.json. Deployed first so the
# backend can resolve the params at deploy (waitlist cap env) and read them at runtime.
step "Deploy WobblioConfigStack-${STAGE} (SSM app config)"
(cd "$INFRA_DIR" && npx cdk deploy "WobblioConfigStack-${STAGE}" \
  --profile "$AWS_PROFILE" --require-approval never)
ok "WobblioConfigStack-${STAGE} deployed"

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

# ── CDK deploy: WobblioStorageStack ───────────────────────────────────────────
step "Deploy WobblioStorageStack-${STAGE} (S3 buckets)"
(cd "$INFRA_DIR" && npx cdk deploy "WobblioStorageStack-${STAGE}" \
  --profile "$AWS_PROFILE" --require-approval never)
ok "WobblioStorageStack-${STAGE} deployed"

# ── CDK deploy: WobblioObservabilityStack ─────────────────────────────────────
step "Deploy WobblioObservabilityStack-${STAGE} (SNS, Budgets, Cost Anomaly)"
(cd "$INFRA_DIR" && npx cdk deploy "WobblioObservabilityStack-${STAGE}" \
  --profile "$AWS_PROFILE" --require-approval never)
ok "WobblioObservabilityStack-${STAGE} deployed"

# ── CDK deploy: WobblioBackendStack ───────────────────────────────────────────
step "Deploy WobblioBackendStack-${STAGE} (Lambda fleet + API Gateway)"
(cd "$INFRA_DIR" && npx cdk deploy "WobblioBackendStack-${STAGE}" \
  --profile "$AWS_PROFILE" --require-approval never)
ok "WobblioBackendStack-${STAGE} deployed"

# ── Database migrations ───────────────────────────────────────────────────────
if [[ $SKIP_MIGRATIONS -eq 0 ]]; then
  step "Database migrations"

  # Migrations create objects — including SECURITY DEFINER helpers — that MUST be owned
  # by the table owner so they bypass RLS (Postgres exempts a table's owner from its
  # policies; we never use FORCE RLS). The per-stage runtime role is a non-owner with no
  # CREATE privilege, so we connect as the RDS master and adopt the owner role via the
  # libpq `options` GUC (master is a member of the owner role). dbname scopes us to this
  # stage's database; the guard below refuses to run against the wrong one.
  MASTER_JSON=$(aws secretsmanager get-secret-value \
    --secret-id "shared/db/master" \
    --profile "$AWS_PROFILE" --region "$AWS_REGION" \
    --query SecretString --output text)
  DB_USER=$(echo "$MASTER_JSON" | jq -r .username)
  DB_PASS=$(echo "$MASTER_JSON" | jq -r .password)
  DB_HOST=$(aws ssm get-parameter --name "/shared/db/endpoint" \
    --profile "$AWS_PROFILE" --region "$AWS_REGION" --query Parameter.Value --output text)
  DB_PORT=$(aws ssm get-parameter --name "/shared/db/port" \
    --profile "$AWS_PROFILE" --region "$AWS_REGION" --query Parameter.Value --output text)
  DB_NAME="$DB_NAME_EXPECTED"

  # Confirm the owner role exists and master can adopt it before we touch the schema.
  ROLE_OK=$(PGPASSWORD="$DB_PASS" psql "sslmode=require host=${DB_HOST} port=${DB_PORT} dbname=${DB_NAME} user=${DB_USER}" \
    -tAq -c "SELECT pg_has_role('${DB_USER}', '${DB_OWNER_ROLE}', 'MEMBER');" 2>/dev/null || echo "f")
  [[ "$ROLE_OK" == "t" ]] || fail "master '${DB_USER}' cannot assume owner role '${DB_OWNER_ROLE}' on ${DB_NAME}"

  export DATABASE_URL="postgres://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=no-verify&options=-c%20role%3D${DB_OWNER_ROLE}"
  info "Running migrations against ${DB_HOST}/${DB_NAME} as owner '${DB_OWNER_ROLE}'..."

  (cd "$INFRA_DIR" && npm run migrate:up)
  ok "Migrations applied (objects owned by ${DB_OWNER_ROLE})"

  # Reconcile function EXECUTE grants: a new SECURITY DEFINER helper is called by the
  # runtime role, but EXECUTE is only auto-granted once provisioning's default privileges
  # are in place. This idempotent re-grant keeps the app able to call every helper.
  PGPASSWORD="$DB_PASS" psql "sslmode=require host=${DB_HOST} port=${DB_PORT} dbname=${DB_NAME} user=${DB_USER}" \
    -v ON_ERROR_STOP=1 -q \
    -c "SET ROLE ${DB_OWNER_ROLE}; GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${DB_RUNTIME_ROLE};"
  ok "Function EXECUTE grants reconciled for ${DB_RUNTIME_ROLE}"
else
  warn "Skipping database migrations (--skip-migrations)"
fi

info "App domain: https://${APP_DOMAIN}"
info "API domain: https://${API_DOMAIN}"

# ── Webapp build + deploy ─────────────────────────────────────────────────────
if [[ $SKIP_WEBAPP -eq 0 ]]; then
  step "Webapp build"

  # Write environment file for Next.js build
  cat > "$WEBAPP_DIR/.env.production" <<EOF
NEXT_PUBLIC_API_BASE_URL=https://${API_DOMAIN}
NEXT_PUBLIC_SITE_URL=https://${APP_DOMAIN}
EOF
  info "Written .env.production"

  # The WobblioWebStack Nextjs construct (cdk-nextjs-standalone) builds the
  # OpenNext SSR bundle itself during `cdk deploy`. Running `next build` here as
  # well double-builds into the same .next dir and intermittently triggers the
  # Next.js 15 "Collecting page data → ENOENT pages-manifest.json" race under
  # deploy-time load. Wipe stale build output so the construct does a single,
  # clean build (a leftover dev-mode .next also trips this).
  info "Cleaning stale webapp build output (.next/.open-next)..."
  rm -rf "$WEBAPP_DIR/.next" "$WEBAPP_DIR/.open-next"
  ok "Webapp build output cleaned (OpenNext build runs inside WobblioWebStack)"

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
printf '  %-30s %s\n' "Landing page:"     "https://${APP_DOMAIN}"
printf '  %-30s %s\n' "API base:"         "https://${API_DOMAIN}"
printf '  %-30s %s\n' "Waitlist status:"  "https://${API_DOMAIN}/waitlist/status"
printf '\n'
info "Smoke test:"
info "  curl -s https://${API_DOMAIN}/waitlist/status"
info "  curl -sI https://${APP_DOMAIN} | grep HTTP/"
printf '\n'
warn "Action required: confirm SNS subscription email sent to ${OPS_EMAIL}"
warn "DNS/ACM validation may take up to 30 minutes on first deploy"
