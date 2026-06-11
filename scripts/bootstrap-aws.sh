#!/usr/bin/env bash
# Bootstrap AWS Environment: Installs PostgreSQL extensions, sets SSM parameters, and creates Stripe secrets.
#
# Profile: reuterAdmin  |  Region: eu-west-1  |  STAGE: prod (default)
#
# Pre-requisites:
#   1. shared-infra deployed
#   2. wobblio onboarded (onboard-app.sh wobblio wobblio_prod)
#   3. AWS CLI and psql client installed
#
# Usage:
#   scripts/bootstrap-aws.sh
#   scripts/bootstrap-aws.sh --stage dev
#   scripts/bootstrap-aws.sh --dbname custom_db
#   scripts/bootstrap-aws.sh --force-ssm --force-stripe
#   scripts/bootstrap-aws.sh --skip-db --skip-ssm
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Defaults ──────────────────────────────────────────────────────────────────
AWS_PROFILE="${AWS_PROFILE:-reuterAdmin}"
AWS_REGION="${AWS_REGION:-eu-west-1}"
STAGE="${STAGE:-prod}"
DB_NAME=""

SKIP_DB=0
SKIP_SSM=0
SKIP_STRIPE=0
FORCE_SSM=0
FORCE_STRIPE=0

# ── Arg parsing ───────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --stage)           STAGE="$2"; shift 2 ;;
    --stage=*)         STAGE="${1#*=}"; shift ;;
    --profile)         AWS_PROFILE="$2"; shift 2 ;;
    --profile=*)       AWS_PROFILE="${1#*=}"; shift ;;
    --region)          AWS_REGION="$2"; shift 2 ;;
    --region=*)        AWS_REGION="${1#*=}"; shift ;;
    --dbname)          DB_NAME="$2"; shift 2 ;;
    --dbname=*)        DB_NAME="${1#*=}"; shift ;;
    --skip-db)         SKIP_DB=1; shift ;;
    --skip-ssm)        SKIP_SSM=1; shift ;;
    --skip-stripe)     SKIP_STRIPE=1; shift ;;
    --force-ssm)       FORCE_SSM=1; shift ;;
    --force-stripe)    FORCE_STRIPE=1; shift ;;
    -h|--help)
      sed -n '2,17p' "$0"; exit 0 ;;
    *)
      echo "Unknown argument: $1. Use --help for usage."; exit 1 ;;
  esac
done

export AWS_PROFILE
export AWS_DEFAULT_REGION="$AWS_REGION"
export AWS_REGION="$AWS_REGION"
export AWS_DEFAULT_OUTPUT="off"

# ── Helpers ───────────────────────────────────────────────────────────────────
bold()  { printf '\033[1m%s\033[0m\n' "$*"; }
step()  { printf '\n\033[34m▶ %s\033[0m\n' "$*"; }
ok()    { printf '  \033[32m✓\033[0m %s\n' "$*"; }
info()  { printf '  \033[34m→\033[0m %s\n' "$*"; }
warn()  { printf '  \033[33m⚠\033[0m %s\n' "$*"; }
fail()  { printf '\033[31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

bold "Wobblio AWS Environment Bootstrap"
info "Stage:   $STAGE"
info "Profile: $AWS_PROFILE"
info "Region:  $AWS_REGION"

# ── Pre-flight checks ─────────────────────────────────────────────────────────
step "Pre-flight checks"

REQUIRED_CMDS=("aws" "jq")
if [[ $SKIP_DB -eq 0 ]]; then
  REQUIRED_CMDS+=("psql")
fi

for cmd in "${REQUIRED_CMDS[@]}"; do
  command -v "$cmd" >/dev/null 2>&1 || fail "'$cmd' not found on PATH"
done
ok "Required tools present (${REQUIRED_CMDS[*]})"

aws sts get-caller-identity > /dev/null 2>&1 \
  || fail "AWS credentials not valid for profile '$AWS_PROFILE'. Run: aws configure --profile $AWS_PROFILE"
ok "AWS credentials valid"


# ── Phase 1: Database Setup ───────────────────────────────────────────────────
if [[ $SKIP_DB -eq 0 ]]; then
  step "Phase 1: Database Extensions Onboarding"

  # Resolve RDS DB Endpoint
  DB_HOST=$(aws ssm get-parameter \
    --name /shared/db/endpoint \
    --query Parameter.Value --output text 2>/dev/null) || fail "SSM parameter /shared/db/endpoint not found."
  ok "DB Endpoint resolved: $DB_HOST"

  # Resolve DB Name
  if [[ -z "$DB_NAME" ]]; then
    # Determine SSM parameter name for secret ARN
    PARAM_NAME="/shared/db/wobblio/secret-arn"
    if [[ "$STAGE" != "prod" ]]; then
      ALT_PARAM="/shared/db/wobblio-${STAGE}/secret-arn"
      if aws ssm get-parameter --name "$ALT_PARAM" >/dev/null 2>&1; then
        PARAM_NAME="$ALT_PARAM"
      fi
    fi

    info "Resolving database name from SSM parameter $PARAM_NAME..."
    SECRET_ARN=$(aws ssm get-parameter \
      --name "$PARAM_NAME" \
      --query Parameter.Value --output text 2>/dev/null) || true

    if [[ -n "$SECRET_ARN" ]]; then
      SECRET_JSON=$(aws secretsmanager get-secret-value \
        --secret-id "$SECRET_ARN" \
        --query SecretString --output text 2>/dev/null) || true
      if [[ -n "$SECRET_JSON" ]]; then
        DB_NAME=$(echo "$SECRET_JSON" | jq -r .dbname)
      fi
    fi

    if [[ -z "$DB_NAME" ]]; then
      warn "Could not resolve database name from Secrets Manager. Defaulting to wobblio_${STAGE}"
      DB_NAME="wobblio_${STAGE}"
    fi
  fi
  info "Target Database Name: $DB_NAME"

  # Retrieve Master Credentials
  info "Retrieving database master credentials..."
  MASTER_SECRET=$(aws secretsmanager get-secret-value \
    --secret-id shared/db/master \
    --query SecretString --output text 2>/dev/null) || fail "Failed to retrieve Secrets Manager secret: shared/db/master"

  MASTER_PASSWORD=$(echo "$MASTER_SECRET" | jq -r .password)
  ok "Master credentials retrieved"

  # Install Extensions
  info "Installing extensions (uuid-ossp, pg_trgm, vector) in $DB_NAME..."
  psql "host=$DB_HOST port=5432 user=postgres password=$MASTER_PASSWORD dbname=$DB_NAME sslmode=require" <<'SQL'
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;
SQL
  ok "Extensions installed/verified"

  # Verification
  info "Verifying extensions..."
  psql "host=$DB_HOST port=5432 user=postgres password=$MASTER_PASSWORD dbname=$DB_NAME sslmode=require" \
    -c "SELECT extname, extversion FROM pg_extension WHERE extname IN ('uuid-ossp','pg_trgm','vector');"
  ok "Database extensions verified"
else
  info "Skipping Phase 1: Database Setup"
fi


# ── Phase 2: SSM Parameters ───────────────────────────────────────────────────
if [[ $SKIP_SSM -eq 0 ]]; then
  step "Phase 2: SSM Parameters Setup"

  set_ssm_param() {
    local name="$1"
    local value="$2"

    if [[ $FORCE_SSM -eq 0 ]]; then
      # Check if parameter already exists
      if aws ssm get-parameter --name "$name" >/dev/null 2>&1; then
        info "SSM parameter $name already exists. Skipping (use --force-ssm to overwrite)."
        return
      fi
    fi

    info "Setting SSM parameter $name..."
    aws ssm put-parameter \
      --name "$name" \
      --value "$value" \
      --type String \
      --overwrite \
      || fail "Failed to set SSM parameter $name"
  }

  # ── Bedrock model IDs ──────────────────────────────────────────────────────────
  set_ssm_param "/wobblio/config/models/vision_parser"   "amazon.nova-lite-v1:0"
  set_ssm_param "/wobblio/config/models/auxiliary"       "anthropic.claude-haiku-4-5-20251001-v1:0"
  set_ssm_param "/wobblio/config/models/insight"         "anthropic.claude-sonnet-4-6-v1:0"
  set_ssm_param "/wobblio/config/models/embedder"        "amazon.titan-embed-text-v2:0"

  # ── Quotas ────────────────────────────────────────────────────────────────────
  set_ssm_param "/wobblio/config/quotas/standard_uploads_per_week"   "3"
  set_ssm_param "/wobblio/config/quotas/premium_uploads_per_week"    "10"
  set_ssm_param "/wobblio/config/quotas/household_uploads_per_week"  "20"
  set_ssm_param "/wobblio/config/quotas/max_free_waitlist_cap"       "5000"

  # ── Routing ───────────────────────────────────────────────────────────────────
  set_ssm_param "/wobblio/config/routing/max_stores"            "3"
  set_ssm_param "/wobblio/config/routing/min_split_saving_eur"  "5.00"

  # ── Tags / AI ─────────────────────────────────────────────────────────────────
  set_ssm_param "/wobblio/config/tags/dedicated_call_enabled"  "false"
  set_ssm_param "/wobblio/config/tags/vocabulary"              "[]"
  set_ssm_param "/wobblio/config/ai/daily_spend_cap"           "0.10"

  # ── Operations ────────────────────────────────────────────────────────────────
  set_ssm_param "/wobblio/config/ops/email"            "antonioreuter@gmail.com"
  set_ssm_param "/wobblio/config/web_app_url"          "https://wobblio.com"

  # ── Billing ───────────────────────────────────────────────────────────────────
  set_ssm_param "/wobblio/config/billing/mock_premium_whitelist"  "-"

  ok "SSM parameters verified/set."
else
  info "Skipping Phase 2: SSM Parameters Setup"
fi


# ── Phase 3: Stripe Credentials ────────────────────────────────────────────────
if [[ $SKIP_STRIPE -eq 0 ]]; then
  step "Phase 3: Stripe Credentials Setup"

  SECRET_NAME="wobblio/${STAGE}/stripe"

  if [[ $FORCE_STRIPE -eq 0 ]] && aws secretsmanager describe-secret --secret-id "$SECRET_NAME" >/dev/null 2>&1; then
    info "Secrets Manager secret $SECRET_NAME already exists. Skipping (use --force-stripe to overwrite)."
  else
    info "Creating/updating Secrets Manager secret $SECRET_NAME..."
    
    # Check if it exists to decide create-secret or put-secret-value
    if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" >/dev/null 2>&1; then
      aws secretsmanager put-secret-value \
        --secret-id "$SECRET_NAME" \
        --secret-string '{"secretKey":"sk_live_placeholder_change_me","webhookSecret":"whsec_placeholder_change_me"}' \
        || fail "Failed to update Secrets Manager secret $SECRET_NAME"
      ok "Stripe secret updated (with placeholders)"
    else
      aws secretsmanager create-secret \
        --name "$SECRET_NAME" \
        --description "Stripe API keys for Wobblio ${STAGE}" \
        --secret-string '{"secretKey":"sk_live_placeholder_change_me","webhookSecret":"whsec_placeholder_change_me"}' \
        || fail "Failed to create Secrets Manager secret $SECRET_NAME"
      ok "Stripe secret created (with placeholders)"
    fi
    
    warn "Stripe secret $SECRET_NAME was created/updated with PLACEHOLDER values."
    warn "Ensure you update it with real keys from your Stripe Dashboard prior to processing transactions."
  fi
else
  info "Skipping Phase 3: Stripe Credentials Setup"
fi



step "Bootstrap Complete"
bold "AWS environment bootstrap finished successfully!"
