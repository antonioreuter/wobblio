#!/usr/bin/env bash
# Bootstrap the fully local development environment.
# Starts Docker services, installs PostgreSQL extensions, deploys the LocalStack
# CDK bootstrap stack, runs migrations, and seeds reference data.
#
# No AWS credentials required. All services run on your machine.
#
# Usage:
#   scripts/local/bootstrap.sh
#   scripts/local/bootstrap.sh --skip-docker
#   scripts/local/bootstrap.sh --skip-cdk
#   scripts/local/bootstrap.sh --skip-db
#   scripts/local/bootstrap.sh --skip-seed
#   scripts/local/bootstrap.sh --force-seed
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
INFRA_DIR="$REPO_ROOT/Source/infra"
BACKEND_DIR="$REPO_ROOT/Source/backend"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
CONFIG_FILE="$REPO_ROOT/config/local.env"
ENV_FILE="$REPO_ROOT/.env.local"

# ── Defaults ──────────────────────────────────────────────────────────────────
SKIP_DOCKER=0
SKIP_CDK=0
SKIP_DB=0
SKIP_SEED=0
FORCE_SEED=0

# ── Arg parsing ───────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-docker)  SKIP_DOCKER=1; shift ;;
    --skip-cdk)     SKIP_CDK=1; shift ;;
    --skip-db)      SKIP_DB=1; shift ;;
    --skip-seed)    SKIP_SEED=1; shift ;;
    --force-seed)   FORCE_SEED=1; shift ;;
    -h|--help)
      sed -n '2,14p' "$0"; exit 0 ;;
    *)
      echo "Unknown argument: $1. Use --help for usage."; exit 1 ;;
  esac
done

# ── Helpers ───────────────────────────────────────────────────────────────────
bold() { printf '\033[1m%s\033[0m\n' "$*"; }
step() { printf '\n\033[34m▶ %s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
info() { printf '  \033[34m→\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m⚠\033[0m %s\n' "$*"; }
fail() { printf '\033[31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

bold "Wobblio Local Environment Bootstrap"

# ── Load config ───────────────────────────────────────────────────────────────
[[ -f "$CONFIG_FILE" ]] || fail "Config file not found: $CONFIG_FILE"
# shellcheck source=/dev/null
set -a; source "$CONFIG_FILE"; set +a
ok "Config loaded: config/local.env (STAGE=${STAGE})"

info "LocalStack: http://localhost:${LOCALSTACK_PORT:-4566}"
info "Postgres:   ${DB_HOST}:${DB_PORT} / ${DB_NAME}"

# ── Pre-flight checks ─────────────────────────────────────────────────────────
step "Pre-flight checks"

for cmd in docker node npm psql; do
  command -v "$cmd" >/dev/null 2>&1 || fail "'$cmd' not found on PATH. Install it and retry."
done
ok "Required tools present (docker, node, npm, psql)"

docker info > /dev/null 2>&1 || fail "Docker is not running. Start Docker Desktop and retry."
ok "Docker running"

# Keep .env.local in sync with config/local.env for tooling that expects it
if [[ ! -f "$ENV_FILE" ]] || ! diff -q "$CONFIG_FILE" "$ENV_FILE" > /dev/null 2>&1; then
  cp "$CONFIG_FILE" "$ENV_FILE"
  cp "$CONFIG_FILE" "$REPO_ROOT/Source/webapp/.env.local"
  ok ".env.local synced from config/local.env (root + Source/webapp)"
fi


# ── Phase 1: Docker Services ──────────────────────────────────────────────────
if [[ $SKIP_DOCKER -eq 0 ]]; then
  step "Phase 1: Docker Services"

  info "Starting LocalStack and Postgres..."
  docker compose -f "$COMPOSE_FILE" up -d --wait
  ok "LocalStack healthy (http://localhost:4566)"
  ok "Postgres healthy (localhost:5432)"
else
  info "Skipping Phase 1: Docker Services"
fi


# ── Phase 1b: cognito-local Init ──────────────────────────────────────────────
if [[ $SKIP_DOCKER -eq 0 ]]; then
  step "Phase 1b: cognito-local — user pool + client + test user"
  bash "$SCRIPT_DIR/init-cognito.sh"
else
  info "Skipping Phase 1b: cognito-local Init (--skip-docker)"
fi


# ── Phase 2: PostgreSQL Extensions ───────────────────────────────────────────
if [[ $SKIP_DB -eq 0 ]]; then
  step "Phase 2: PostgreSQL Extensions"

  # Local Docker sets POSTGRES_USER as superuser — no separate master user needed.
  LOCAL_DB_URL="${DATABASE_URL:-postgres://wobblio_dev:wobblio_dev_secret@localhost:5432/wobblio_local}"

  info "Installing extensions (uuid-ossp, pg_trgm, vector)..."
  psql "$LOCAL_DB_URL" <<'SQL'
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;
SQL
  ok "Extensions installed"

  info "Verifying extensions..."
  psql "$LOCAL_DB_URL" \
    -c "SELECT extname, extversion FROM pg_extension WHERE extname IN ('uuid-ossp','pg_trgm','vector');"
  ok "Extensions verified"
else
  info "Skipping Phase 2: PostgreSQL Extensions"
fi


# ── Phase 3: Install Dependencies ────────────────────────────────────────────
step "Phase 3: Dependencies"

for dir in "$BACKEND_DIR" "$INFRA_DIR"; do
  if [[ -d "$dir" ]]; then
    cd "$dir"
    if [[ ! -d node_modules ]]; then
      info "npm install in $(basename "$dir")..."
      npm install --silent
    fi
    ok "$(basename "$dir") ready"
  fi
done


# ── Phase 4: LocalStack CDK Bootstrap ────────────────────────────────────────
if [[ $SKIP_CDK -eq 0 ]]; then
  step "Phase 4: LocalStack CDK Bootstrap (WobblioLocalBootstrapStack)"

  cd "$INFRA_DIR"
  info "Deploying WobblioLocalBootstrapStack via cdklocal..."
  # AWS_ENDPOINT_URL + AWS_ENDPOINT_URL_S3 come from config/local.env (sourced above).
  # Fail loudly: a masked failure here leaves the app with no S3 buckets or SQS queues.
  if STAGE=local npm run cdk:deploy:local -- WobblioLocalBootstrapStack; then
    ok "S3 buckets, SQS queues, SSM parameters, Secrets Manager stubs ready"
  else
    fail "CDK bootstrap deploy failed — S3 buckets / SQS queues not provisioned (see output above)"
  fi

  info "Verifying LocalStack resources..."
  # S3 buckets
  aws --endpoint-url=http://localhost:4566 s3 ls 2>/dev/null \
    | awk '{print "  bucket: "$3}' || warn "Could not list S3 buckets"
  # SQS queues
  aws --endpoint-url=http://localhost:4566 sqs list-queues \
    --query "QueueUrls[]" --output text 2>/dev/null \
    | tr '\t' '\n' | awk '{print "  queue: "$0}' || warn "Could not list SQS queues"
  ok "LocalStack resources verified"
else
  info "Skipping Phase 4: LocalStack CDK Bootstrap"
fi


# ── Phase 5: Database Migrations ─────────────────────────────────────────────
if [[ $SKIP_DB -eq 0 ]]; then
  step "Phase 5: Database Migrations"

  cd "$INFRA_DIR"
  if ls src/migrations/*.ts 2>/dev/null | grep -qv config.ts; then
    DATABASE_URL="${DATABASE_URL}" npm run migrate:up
    ok "Migrations applied"

    info "Verifying migration ledger..."
    psql "${DATABASE_URL}" -c "SELECT name, run_on FROM pgmigrations ORDER BY run_on;" 2>/dev/null || true
  else
    warn "No migration files found — skipping (added in Spec 02)"
  fi
else
  info "Skipping Phase 5: Database Migrations"
fi


# ── Phase 6: Seed Reference Data ─────────────────────────────────────────────
if [[ $SKIP_SEED -eq 0 ]]; then
  step "Phase 6: Seed Reference Data"

  cd "$INFRA_DIR"

  # Check if already seeded (skip unless --force-seed)
  MERCHANT_COUNT=$(psql "${DATABASE_URL}" -t -c \
    "SELECT COUNT(*) FROM merchant;" 2>/dev/null | tr -d ' ' || echo "0")

  if [[ "$MERCHANT_COUNT" -gt "0" && $FORCE_SEED -eq 0 ]]; then
    info "Reference data already present ($MERCHANT_COUNT merchants). Skipping (use --force-seed to reseed)."
  else
    info "Seeding merchants, product taxonomy, and SSM parameters..."
    DATABASE_URL="${DATABASE_URL}" \
      AWS_ENDPOINT_URL=http://localhost:4566 \
      npm run seed:local
    ok "Reference data seeded"
  fi
else
  info "Skipping Phase 6: Seed Reference Data"
fi


# ── Phase 7: Dev User DB Profile ─────────────────────────────────────────────
# init-cognito.sh (Phase 1b) creates the Cognito test user, but the matching
# app_user row is provisioned separately (prod: post-confirmation Lambda; local
# UI: register flow). Without it, login authenticates yet /me/profile finds no
# user → the onboarding gate force-signs-out to the landing page. Provision it
# here — after migrations (Phase 5) and cognito (Phase 1b) are both ready — as an
# onboarded user so the seeded login lands straight on the dashboard. Idempotent.
if [[ $SKIP_SEED -eq 0 && $SKIP_DB -eq 0 ]]; then
  step "Phase 7: Dev User DB Profile (dev@wobblio.local)"
  # Re-source config: init-cognito.sh may have written a fresh pool/client id.
  set -a; source "$CONFIG_FILE"; set +a

  DEV_SUB=$(aws cognito-idp list-users \
    --user-pool-id "$COGNITO_USER_POOL_ID" \
    --filter 'email = "dev@wobblio.local"' \
    --endpoint-url "${COGNITO_ENDPOINT:-http://localhost:9229}" \
    --region "${AWS_REGION:-eu-west-1}" \
    --query "Users[0].Username" --output text 2>/dev/null || echo "")

  if [[ -z "$DEV_SUB" || "$DEV_SUB" == "None" ]]; then
    warn "Cognito test user not found — skipping app_user provisioning"
  else
    psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -v sub="$DEV_SUB" >/dev/null <<'SQL'
SELECT provision_new_user(:'sub', 'dev@wobblio.local', 'ACTIVE', 'Dev User');
UPDATE app_user
   SET onboarded_at    = COALESCE(onboarded_at, now()),
       gdpr_consent_at = COALESCE(gdpr_consent_at, now()),
       birthdate       = COALESCE(birthdate, '1990-01-01')
 WHERE cognito_sub = :'sub';
SQL
    ok "app_user provisioned + onboarded for dev@wobblio.local"
  fi
else
  info "Skipping Phase 7: Dev User DB Profile"
fi


# ── Done ──────────────────────────────────────────────────────────────────────
step "Bootstrap Complete"
bold "Local environment bootstrap finished successfully!"
echo ""
printf '  %-30s %s\n' "LocalStack:"       "http://localhost:4566"
printf '  %-30s %s\n' "Postgres:"         "localhost:5432 / wobblio_local"
printf '  %-30s %s\n' "S3 uploads bucket:" "wobblio-uploads-local"
printf '  %-30s %s\n' "SQS ingestion:"    "wobblio-ingestion-local"
echo ""
info "Start the webapp: cd Source/webapp && npm run dev → http://localhost:3000"
info "Run tests:        cd Source/backend && npm run test:unit"
info "Validate:         make validate"
echo ""
