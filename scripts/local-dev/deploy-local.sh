#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_DIR="$REPO_ROOT/Source/backend"
INFRA_DIR="$REPO_ROOT/Source/infra"
ENV_FILE="$REPO_ROOT/.env.local"

# ── Helpers ───────────────────────────────────────────────────────────────────

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
info() { printf '  \033[34m→\033[0m %s\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m⚠\033[0m %s\n' "$*"; }
fail() { printf '\033[31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

wait_for_http() {
  local url="$1" label="$2" retries="${3:-30}" delay="${4:-2}"
  info "Waiting for $label ($url)..."
  for i in $(seq 1 "$retries"); do
    if curl -sf "$url" >/dev/null 2>&1; then
      ok "$label is ready"
      return 0
    fi
    sleep "$delay"
    [[ "$i" == "$retries" ]] && fail "$label did not become ready after $((retries * delay))s"
  done
}

wait_for_postgres() {
  info "Waiting for PostgreSQL..."
  for i in $(seq 1 30); do
    if docker compose -f "$SCRIPT_DIR/docker-compose.yml" exec -T postgres pg_isready -U "${POSTGRES_USER:-wobblio_dev}" -q 2>/dev/null; then
      ok "PostgreSQL is ready"
      return 0
    fi
    sleep 2
    [[ "$i" == "30" ]] && fail "PostgreSQL did not become ready after 60s"
  done
}

# ── Step 0: Preflight ─────────────────────────────────────────────────────────

bold "Wobblio local deploy"
echo ""

[[ -f "$ENV_FILE" ]] || fail ".env.local not found. Run: cp .env.local.template .env.local"
# shellcheck source=/dev/null
set -a; source "$ENV_FILE"; set +a

for cmd in docker node npm aws; do
  command -v "$cmd" >/dev/null 2>&1 || fail "'$cmd' not found on PATH"
done

bold "Step 0: Preflight checks"
wait_for_postgres
wait_for_http "http://localhost:4566/_localstack/health" "LocalStack"
wait_for_http "http://localhost:4577/health" "Bedrock mock"
ok "All services healthy"
echo ""

# ── Step 1: Install dependencies ─────────────────────────────────────────────

bold "Step 1: Dependencies"
for dir in "$BACKEND_DIR" "$INFRA_DIR"; do
  cd "$dir"
  if [[ ! -d node_modules ]]; then
    info "Running npm install in $(basename $dir)..."
    npm install --silent
    ok "$(basename $dir) dependencies installed"
  else
    ok "$(basename $dir) node_modules already present"
  fi
done
echo ""

# ── Step 2: CDK bootstrap ─────────────────────────────────────────────────────

bold "Step 2: CDK bootstrap (LocalStack)"
cd "$INFRA_DIR"
AWS_ENDPOINT_URL=http://localhost:4566 \
  AWS_ENDPOINT_URL_S3=http://localhost:4566 \
  AWS_ACCESS_KEY_ID=test \
  AWS_SECRET_ACCESS_KEY=test \
  AWS_DEFAULT_REGION="${AWS_REGION:-eu-west-1}" \
  STAGE=local \
  npx cdklocal bootstrap "aws://000000000000/${AWS_REGION:-eu-west-1}" \
  --toolkit-stack-name CDKToolkit-local \
  2>&1 | grep -v "^$" || true
ok "CDK bootstrap complete"
echo ""

# ── Step 3: CDK synth ─────────────────────────────────────────────────────────

bold "Step 3: CDK synth (cdk-nag gate)"
cd "$INFRA_DIR"
STAGE=local npm run cdk:synth -- --quiet 2>&1 | tail -5
ok "CDK synth passed"
echo ""

# ── Step 4: Deploy WobblioLocalBootstrapStack ─────────────────────────────────

bold "Step 4: Deploy WobblioLocalBootstrapStack"
cd "$INFRA_DIR"
AWS_ENDPOINT_URL=http://localhost:4566 \
  AWS_ENDPOINT_URL_S3=http://localhost:4566 \
  AWS_ACCESS_KEY_ID=test \
  AWS_SECRET_ACCESS_KEY=test \
  AWS_DEFAULT_REGION="${AWS_REGION:-eu-west-1}" \
  STAGE=local \
  npx cdklocal deploy WobblioLocalBootstrapStack \
  --require-approval never \
  --outputs-file /tmp/wobblio-cdk-outputs.json \
  2>&1 | grep -E "(✅|❌|CREATE|UPDATE|DELETE|Stack|Error)" || true
ok "WobblioLocalBootstrapStack deployed"
echo ""

# ── Step 5: Database migrations ───────────────────────────────────────────────

bold "Step 5: Database migrations"
cd "$INFRA_DIR"
if ls src/migrations/*.ts 2>/dev/null | grep -qv config.ts; then
  DATABASE_URL="${DATABASE_URL}" npm run migrate:up
  ok "Migrations applied"
else
  warn "No migration files found — skipping (they will be added in Spec 02)"
fi
echo ""

# ── Step 6: Seed data (SSM parameters + PostgreSQL) ──────────────────────────

bold "Step 6: Seed data"
cd "$INFRA_DIR"
AWS_ENDPOINT_URL=http://localhost:4566 \
  AWS_ENDPOINT_URL_S3=http://localhost:4566 \
  AWS_ACCESS_KEY_ID=test \
  AWS_SECRET_ACCESS_KEY=test \
  AWS_REGION="${AWS_REGION:-eu-west-1}" \
  DATABASE_URL="${DATABASE_URL}" \
  npm run seed:local
ok "Seed complete"
echo ""

# ── Step 7: Summary ───────────────────────────────────────────────────────────

bold "Local stack ready!"
echo ""
printf '  %-28s %s\n' "PostgreSQL"        "postgresql://${POSTGRES_USER:-wobblio_dev}@localhost:5432/${POSTGRES_DB:-wobblio_local}"
printf '  %-28s %s\n' "LocalStack"        "http://localhost:4566"
printf '  %-28s %s\n' "Cognito local"     "http://localhost:9229"
printf '  %-28s %s\n' "Bedrock mock"      "http://localhost:4577"
echo ""
printf '  %-28s %s\n' "LocalStack Desktop" "Download: https://docs.localstack.cloud/user-guide/tools/localstack-desktop/"
printf '  %-28s %s\n' ""                  "Connect to: http://localhost:4566"
echo ""
ok "Run 'make logs' to tail all service logs"
