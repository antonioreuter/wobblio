#!/usr/bin/env bash
# Full-build verification: runs every gate that would run in CI / pre-merge.
#
# Stages (in order):
#   1. backend  — hexagonal validator, GDPR/security auditor, unit tests, tsc build
#   2. infra    — tsc build, CDK synth (cdk-nag gate)
#   3. webapp   — lint (next lint + tsc), unit tests, next build
#   4. admin    — lint (next lint + tsc), unit tests, next build
#   5. backend  — integration tests against LocalStack (skipped if --skip-integration
#                 or if the local stack is not healthy)
#
# Usage:
#   scripts/ci-all.sh                  # run everything
#   scripts/ci-all.sh --skip-integration
#   scripts/ci-all.sh --only backend
#   scripts/ci-all.sh --only backend,infra
#
# Each step's full log is written to /tmp/wobblio-ci/<step>.log. On failure,
# the tail of the failing log is printed and the script exits non-zero.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/Source/backend"
INFRA_DIR="$REPO_ROOT/Source/infra"
WEBAPP_DIR="$REPO_ROOT/Source/webapp"
ADMIN_DIR="$REPO_ROOT/Source/admin"
LOG_DIR="/tmp/wobblio-ci"
# Use config/local.env as canonical source; fall back to .env.local for local overrides
ENV_FILE="$REPO_ROOT/config/local.env"
[[ -f "$REPO_ROOT/.env.local" ]] && ENV_FILE="$REPO_ROOT/.env.local"

mkdir -p "$LOG_DIR"

# ── Args ──────────────────────────────────────────────────────────────────────
SKIP_INTEGRATION=0
ONLY=""
for arg in "$@"; do
  case "$arg" in
    --skip-integration) SKIP_INTEGRATION=1 ;;
    --only) shift; ONLY="${1:-}" ;;
    --only=*) ONLY="${arg#*=}" ;;
    -h|--help)
      sed -n '2,18p' "$0"; exit 0 ;;
    *)
      if [[ -n "${prev_only:-}" ]]; then ONLY="$arg"; unset prev_only; fi ;;
  esac
done

want() {
  [[ -z "$ONLY" ]] && return 0
  [[ ",$ONLY," == *",$1,"* ]]
}

# ── Pretty printing ───────────────────────────────────────────────────────────
bold()  { printf '\033[1m%s\033[0m\n' "$*"; }
step()  { printf '\033[34m▶\033[0m %s\n' "$*"; }
ok()    { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn()  { printf '  \033[33m⚠\033[0m %s\n' "$*"; }
fail()  { printf '\033[31m✗\033[0m %s\n' "$*" >&2; }

START_TIME=$(date +%s)
declare -a RAN_OK
declare -a SKIPPED

run() {
  local label="$1"; shift
  local logfile="$LOG_DIR/${label// /_}.log"
  step "$label"
  local started
  started=$(date +%s)
  if "$@" >"$logfile" 2>&1; then
    local elapsed=$(( $(date +%s) - started ))
    ok "$label (${elapsed}s) — log: $logfile"
    RAN_OK+=("$label")
  else
    local code=$?
    local elapsed=$(( $(date +%s) - started ))
    fail "$label failed after ${elapsed}s (exit $code) — log: $logfile"
    echo "── tail of $logfile ──"
    tail -60 "$logfile" >&2 || true
    echo "── end log tail ──"
    exit "$code"
  fi
}

skip() {
  warn "skip: $1"
  SKIPPED+=("$1")
}

# ── Preflight ────────────────────────────────────────────────────────────────
bold "Wobblio full-build verification"
echo "  logs → $LOG_DIR"
echo ""

cd_run() { (cd "$1" && shift && "$@"); }

# ── 1. backend (offline gates) ────────────────────────────────────────────────
if want backend; then
  bold "[1/5] backend — offline gates"
  run "backend:hexagonal-validator" \
    bash -c "cd '$BACKEND_DIR' && npm run skill:hexagonal-architecture-validator"
  run "backend:validate-security" \
    bash -c "cd '$BACKEND_DIR' && npm run validate:security"
  run "backend:unit-tests" \
    bash -c "cd '$BACKEND_DIR' && npm run test:unit"
  run "backend:tsc-build" \
    bash -c "cd '$BACKEND_DIR' && npm run build"
  echo ""
fi

# ── 2. infra (cdk synth + cdk-nag) ────────────────────────────────────────────
if want infra; then
  bold "[2/5] infra — build + cdk synth"
  run "infra:tsc-build" \
    bash -c "cd '$INFRA_DIR' && npm run build"
  run "infra:cdk-synth" \
    bash -c "cd '$INFRA_DIR' && STAGE=local npm run cdk:synth -- --quiet"
  echo ""
fi

# ── 3. webapp ─────────────────────────────────────────────────────────────────
if want webapp; then
  bold "[3/5] webapp — lint + unit + build"
  run "webapp:lint" \
    bash -c "cd '$WEBAPP_DIR' && npm run lint"
  run "webapp:unit-tests" \
    bash -c "cd '$WEBAPP_DIR' && npm run test:unit"
  run "webapp:next-build" \
    bash -c "cd '$WEBAPP_DIR' && npm run build"
  echo ""
fi

# ── 4. admin ──────────────────────────────────────────────────────────────────
if want admin; then
  bold "[4/5] admin — lint + unit + build"
  run "admin:lint" \
    bash -c "cd '$ADMIN_DIR' && npm run lint"
  run "admin:unit-tests" \
    bash -c "cd '$ADMIN_DIR' && npm run test:unit"
  run "admin:next-build" \
    bash -c "cd '$ADMIN_DIR' && npm run build"
  echo ""
fi

# ── 5. backend integration tests (LocalStack) ─────────────────────────────────
if want backend && [[ $SKIP_INTEGRATION -eq 0 ]]; then
  bold "[5/5] backend — integration tests against LocalStack"
  if ! [[ -f "$ENV_FILE" ]]; then
    skip "integration tests: .env.local not found (cp .env.local.template .env.local)"
  elif ! curl -sf http://localhost:4566/_localstack/health >/dev/null 2>&1; then
    skip "integration tests: LocalStack not reachable at http://localhost:4566 (run 'make start && make deploy')"
  else
    run "backend:integration-tests" \
      bash -c "set -a && source '$ENV_FILE' && set +a && cd '$BACKEND_DIR' && npm run test:integration"
  fi
  echo ""
elif want backend && [[ $SKIP_INTEGRATION -eq 1 ]]; then
  bold "[5/5] backend — integration tests (skipped via --skip-integration)"
  skip "integration tests: --skip-integration flag set"
  echo ""
fi

# ── Summary ──────────────────────────────────────────────────────────────────
ELAPSED=$(( $(date +%s) - START_TIME ))
bold "All gates passed in ${ELAPSED}s"
for s in "${RAN_OK[@]}"; do printf '  \033[32m✓\033[0m %s\n' "$s"; done
if [[ ${#SKIPPED[@]} -gt 0 ]]; then
  echo ""
  echo "Skipped:"
  for s in "${SKIPPED[@]}"; do printf '  \033[33m⚠\033[0m %s\n' "$s"; done
fi
