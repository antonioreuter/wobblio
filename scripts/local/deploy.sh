#!/usr/bin/env bash
# Set up the fully local development environment.
# Starts Docker services (LocalStack + Postgres), deploys WobblioLocalBootstrapStack
# via cdklocal, runs database migrations, and seeds reference data.
#
# Usage: make deploy   (or ./scripts/local/deploy.sh directly)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_DIR="$REPO_ROOT/Source/backend"
INFRA_DIR="$REPO_ROOT/Source/infra"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
CONFIG_FILE="$REPO_ROOT/config/local.env"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
info() { printf '  \033[34m→\033[0m %s\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m⚠\033[0m %s\n' "$*"; }
fail() { printf '\033[31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

# ── Step 0: Preflight ─────────────────────────────────────────────────────────
bold "Wobblio local dev setup (fully local)"
echo ""

[[ -f "$CONFIG_FILE" ]] || fail "Config file not found: config/local.env"
# shellcheck source=/dev/null
set -a; source "$CONFIG_FILE"; set +a
ok "Config loaded: config/local.env (STAGE=${STAGE})"

for cmd in docker node npm; do
  command -v "$cmd" >/dev/null 2>&1 || fail "'$cmd' not found on PATH"
done

docker info > /dev/null 2>&1 || fail "Docker is not running. Start Docker Desktop and retry."
ok "Docker running"
echo ""

# ── Step 1: Start Docker services ─────────────────────────────────────────────
bold "Step 1: Docker services"
docker compose -f "$COMPOSE_FILE" up -d --wait
ok "LocalStack and Postgres are healthy"
echo ""

# ── Step 2: Install dependencies ─────────────────────────────────────────────
bold "Step 2: Dependencies"
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
echo ""

# ── Step 3: Deploy WobblioLocalBootstrapStack via cdklocal ────────────────────
bold "Step 3: LocalStack bootstrap (S3 · SQS · SSM · Secrets Manager)"
cd "$INFRA_DIR"
AWS_ENDPOINT_URL=http://localhost:4566 \
  STAGE=local \
  npm run cdk:deploy:local -- WobblioLocalBootstrapStack \
  2>&1 | grep -E '(✅|❌|CREATE|UPDATE|DELETE|Error|error)' || true
ok "WobblioLocalBootstrapStack deployed"
echo ""

# ── Step 4: Database migrations ───────────────────────────────────────────────
bold "Step 4: Database migrations"
cd "$INFRA_DIR"
if ls src/migrations/*.ts 2>/dev/null | grep -qv config.ts; then
  DATABASE_URL="${DATABASE_URL}" npm run migrate:up
  ok "Migrations applied"
else
  warn "No migration files found — skipping"
fi
echo ""

# ── Step 4b: Application DB role (RLS enforcement) ────────────────────────────
# The app runtime (config/local.env APP_DATABASE_URL) must connect as a non-owner,
# non-superuser role so Row-Level Security is actually enforced. The owner role used
# for migrations above bypasses RLS, which would silently expose every tenant's rows.
bold "Step 4b: Application DB role (wobblio_app)"
docker compose -f "$COMPOSE_FILE" exec -T -e PGPASSWORD="${DB_PASSWORD}" postgres \
  psql -h localhost -U "${DB_USER}" -d "${DB_NAME}" <<'SQL'
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='wobblio_app') THEN
    CREATE ROLE wobblio_app LOGIN PASSWORD 'wobblio_app_secret' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO wobblio_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO wobblio_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO wobblio_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO wobblio_app;
ALTER DEFAULT PRIVILEGES FOR ROLE wobblio_dev IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO wobblio_app;
ALTER DEFAULT PRIVILEGES FOR ROLE wobblio_dev IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO wobblio_app;
ALTER DEFAULT PRIVILEGES FOR ROLE wobblio_dev IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO wobblio_app;
SQL
ok "wobblio_app role ensured (RLS-enforced runtime role)"
echo ""

# ── Step 5: Seed reference data ───────────────────────────────────────────────
bold "Step 5: Seed reference data"
cd "$INFRA_DIR"
DATABASE_URL="${DATABASE_URL}" \
  AWS_ENDPOINT_URL=http://localhost:4566 \
  npm run seed:local
ok "Reference data seeded"
echo ""

# ── Summary ───────────────────────────────────────────────────────────────────
bold "Local dev environment ready"
echo ""
printf '  %-28s %s\n' "Webapp:"          "http://localhost:3000  (cd Source/webapp && npm run dev)"
printf '  %-28s %s\n' "API (local):"     "http://localhost:3001"
printf '  %-28s %s\n' "LocalStack:"      "http://localhost:4566"
printf '  %-28s %s\n' "Postgres:"        "localhost:5432 / wobblio_local"
printf '  %-28s %s\n' "Stage:"           "local"
echo ""
ok "Run 'make validate' to check architecture and security rules"
