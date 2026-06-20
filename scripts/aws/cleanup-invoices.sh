#!/usr/bin/env bash
# Remove ALL invoices and related resources from a Wobblio AWS stage.
#
# Wipes (all tenants):
#   DB  : invoice_share, invoice_feedback, bill_split_line, bill_split,
#         invoice_line, invoice, ingestion_ledger, price_observation
#   S3  : every object in the uploads bucket (receipt images)
#
# price_observation is de-identified and normally survives deletion (spec §6.5 /
# invariant 2). It is included here ONLY because this is an explicit dev reset.
#
# SAFETY: hard-refuses any stage other than 'dev'. The production database and
# buckets are NEVER a valid target for this script.
#
# Usage:
#   scripts/aws/cleanup-invoices.sh                 # dev (default), interactive confirm
#   scripts/aws/cleanup-invoices.sh --yes           # skip the confirm prompt
#   scripts/aws/cleanup-invoices.sh --skip-s3       # DB only, leave S3 receipts
#   STAGE=dev scripts/aws/cleanup-invoices.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# ── Defaults ──────────────────────────────────────────────────────────────────
STAGE="${STAGE:-dev}"
ASSUME_YES=0
SKIP_S3=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --stage)    STAGE="$2"; shift 2 ;;
    --stage=*)  STAGE="${1#*=}"; shift ;;
    --yes|-y)   ASSUME_YES=1; shift ;;
    --skip-s3)  SKIP_S3=1; shift ;;
    -h|--help)  sed -n '2,24p' "$0"; exit 0 ;;
    *)          echo "Unknown argument: $1. Use --help."; exit 1 ;;
  esac
done

bold()  { printf '\033[1m%s\033[0m\n' "$*"; }
step()  { printf '\n\033[34m▶ %s\033[0m\n' "$*"; }
ok()    { printf '  \033[32m✓\033[0m %s\n' "$*"; }
info()  { printf '  \033[34m→\033[0m %s\n' "$*"; }
warn()  { printf '  \033[33m⚠\033[0m %s\n' "$*"; }
fail()  { printf '\033[31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

# ── Production guard (NON-NEGOTIABLE) ─────────────────────────────────────────
if [[ "$STAGE" != "dev" ]]; then
  fail "Refusing to run for stage '$STAGE'. This script targets the dev stage only.
       Never run destructive cleanup against production or any non-dev environment."
fi

# ── Load stage config ─────────────────────────────────────────────────────────
CONFIG_FILE="$REPO_ROOT/config/${STAGE}.env"
[[ -f "$CONFIG_FILE" ]] || fail "Config file not found: config/${STAGE}.env"
# shellcheck source=/dev/null
set -a; source "$CONFIG_FILE"; set +a

AWS_PROFILE="${AWS_PROFILE:-reuterAdmin}"
AWS_REGION="${AWS_REGION:-eu-west-1}"
export AWS_PROFILE AWS_DEFAULT_REGION="$AWS_REGION"

# dev uses the underscore-suffixed shared-DB secret pointer; prod's canonical
# pointer is unreachable from here because STAGE!=dev already aborted above.
DB_SECRET_PARAM="/shared/db/wobblio_${STAGE}/secret-arn"
UPLOADS_BUCKET="${S3_UPLOADS_BUCKET:-wobblio-uploads-${STAGE}}"

bold "Wobblio invoice cleanup"
info "Stage:   $STAGE"
info "Profile: $AWS_PROFILE"
info "Region:  $AWS_REGION"

# ── Pre-flight ────────────────────────────────────────────────────────────────
step "Pre-flight checks"
for cmd in aws jq psql; do
  command -v "$cmd" >/dev/null 2>&1 || fail "'$cmd' not found on PATH"
done
ok "Required tools present (aws, jq, psql)"

aws sts get-caller-identity --profile "$AWS_PROFILE" >/dev/null 2>&1 \
  || fail "AWS credentials not valid for profile '$AWS_PROFILE'."
ok "AWS credentials valid"

SECRET_ARN=$(aws ssm get-parameter --name "$DB_SECRET_PARAM" \
  --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --query Parameter.Value --output text 2>/dev/null) \
  || fail "$DB_SECRET_PARAM not found."
SECRET_JSON=$(aws secretsmanager get-secret-value --secret-id "$SECRET_ARN" \
  --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --query SecretString --output text)

DB_USER=$(echo "$SECRET_JSON" | jq -r .username)
DB_PASS=$(echo "$SECRET_JSON" | jq -r .password)
DB_HOST=$(echo "$SECRET_JSON" | jq -r .host)
DB_PORT=$(echo "$SECRET_JSON" | jq -r .port)
DB_NAME=$(echo "$SECRET_JSON" | jq -r .dbname)

# Second guard: the resolved database name must be the dev database.
[[ "$DB_NAME" == "wobblio_dev" ]] \
  || fail "Resolved DB name '$DB_NAME' is not 'wobblio_dev'. Aborting."
ok "Target database: $DB_HOST/$DB_NAME"
ok "Target bucket:   s3://$UPLOADS_BUCKET"

export PGPASSWORD="$DB_PASS"
PSQL=(psql "sslmode=require host=$DB_HOST port=$DB_PORT dbname=$DB_NAME user=$DB_USER" -v ON_ERROR_STOP=1 -qtA)

# ── Current footprint ─────────────────────────────────────────────────────────
step "Current footprint (all tenants)"
COUNT_SQL="SELECT
  (SELECT count(*) FROM invoice),
  (SELECT count(*) FROM invoice_line),
  (SELECT count(*) FROM ingestion_ledger),
  (SELECT count(*) FROM price_observation);"
read -r N_INV N_LINE N_LEDGER N_PRICE < <("${PSQL[@]}" -F' ' -c "$COUNT_SQL")
info "invoice            : $N_INV"
info "invoice_line       : $N_LINE"
info "ingestion_ledger   : $N_LEDGER"
info "price_observation  : $N_PRICE"

if [[ $SKIP_S3 -eq 0 ]]; then
  N_OBJ=$(aws s3 ls "s3://$UPLOADS_BUCKET" --recursive --profile "$AWS_PROFILE" 2>/dev/null | wc -l | tr -d ' ')
  info "s3 receipt objects : $N_OBJ"
fi

# ── Confirm ───────────────────────────────────────────────────────────────────
if [[ $ASSUME_YES -eq 0 ]]; then
  printf '\n'
  warn "This permanently deletes ALL invoices + price observations for ALL tenants in DEV."
  read -r -p "  Type 'wipe dev' to proceed: " REPLY
  [[ "$REPLY" == "wipe dev" ]] || { echo "Aborted."; exit 1; }
fi

# ── DB wipe ───────────────────────────────────────────────────────────────────
step "Truncating invoice graph + price_observation"
"${PSQL[@]}" -c "TRUNCATE TABLE
  invoice_share,
  invoice_feedback,
  bill_split_line,
  bill_split,
  invoice_line,
  invoice,
  ingestion_ledger,
  price_observation
  RESTART IDENTITY CASCADE;"
ok "Tables truncated"

# ── S3 wipe ───────────────────────────────────────────────────────────────────
if [[ $SKIP_S3 -eq 0 ]]; then
  step "Emptying receipt bucket s3://$UPLOADS_BUCKET"
  aws s3 rm "s3://$UPLOADS_BUCKET" --recursive --profile "$AWS_PROFILE" >/dev/null
  ok "Bucket emptied"
else
  warn "Skipping S3 wipe (--skip-s3); receipt images retained"
fi

# ── Verify ────────────────────────────────────────────────────────────────────
step "Post-cleanup verification"
read -r M_INV M_LINE M_LEDGER M_PRICE < <("${PSQL[@]}" -F' ' -c "$COUNT_SQL")
ok "invoice=$M_INV invoice_line=$M_LINE ingestion_ledger=$M_LEDGER price_observation=$M_PRICE"

printf '\n'
bold "Cleanup complete."
