#!/usr/bin/env bash
# Initialize cognito-local with a user pool, client, and seed test user.
# Writes UserPoolId and ClientId back into config/local.env and .env.local.
#
# Usage: bash scripts/local/init-cognito.sh
# Prereq: cognito-local running on localhost:9229 (make restart)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONFIG_FILE="$REPO_ROOT/config/local.env"
ENV_FILE="$REPO_ROOT/.env.local"
WEBAPP_ENV_FILE="$REPO_ROOT/Source/webapp/.env.local"

COGNITO_ENDPOINT="http://localhost:9229"
REGION="eu-west-1"
AWS_OPTS="--endpoint-url $COGNITO_ENDPOINT --region $REGION"
# cognito-local ignores credentials but AWS CLI requires them
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
step() { printf '\n\033[34m▶ %s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
fail() { printf '\033[31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

bold "Wobblio — cognito-local init"

# ── Pre-flight ────────────────────────────────────────────────────────────────
step "Checking cognito-local"
curl -s --max-time 3 "$COGNITO_ENDPOINT" > /dev/null 2>&1 || \
  fail "cognito-local not reachable at $COGNITO_ENDPOINT. Run: make restart"
ok "cognito-local is up"

# ── Check for existing pool ───────────────────────────────────────────────────
step "Checking for existing user pool"
EXISTING_POOL_ID=$(
  aws cognito-idp list-user-pools --max-results 1 $AWS_OPTS \
    --query "UserPools[?Name=='wobblio-local'].Id" --output text 2>/dev/null || echo ""
)

if [[ -n "$EXISTING_POOL_ID" && "$EXISTING_POOL_ID" != "None" ]]; then
  ok "User pool already exists: $EXISTING_POOL_ID — skipping creation"
  USER_POOL_ID="$EXISTING_POOL_ID"
else
  # ── Create user pool ──────────────────────────────────────────────────────
  step "Creating user pool"
  USER_POOL_ID=$(
    aws cognito-idp create-user-pool \
      --pool-name "wobblio-local" \
      --policies '{"PasswordPolicy":{"MinimumLength":8,"RequireUppercase":false,"RequireLowercase":false,"RequireNumbers":false,"RequireSymbols":false}}' \
      --schema '[
        {"Name":"email","AttributeDataType":"String","Required":true,"Mutable":false},
        {"Name":"role","AttributeDataType":"String","Required":false,"Mutable":true},
        {"Name":"status","AttributeDataType":"String","Required":false,"Mutable":true},
        {"Name":"full_name","AttributeDataType":"String","Required":false,"Mutable":true},
        {"Name":"country","AttributeDataType":"String","Required":false,"Mutable":true},
        {"Name":"language","AttributeDataType":"String","Required":false,"Mutable":true},
        {"Name":"currency","AttributeDataType":"String","Required":false,"Mutable":true}
      ]' \
      --username-attributes email \
      $AWS_OPTS \
      --query "UserPool.Id" --output text
  )
  ok "User pool created: $USER_POOL_ID"
fi

# ── Check for existing client ─────────────────────────────────────────────────
step "Checking for existing app client"
EXISTING_CLIENT_ID=$(
  aws cognito-idp list-user-pool-clients \
    --user-pool-id "$USER_POOL_ID" \
    --max-results 1 \
    $AWS_OPTS \
    --query "UserPoolClients[?ClientName=='wobblio-web-local'].ClientId" --output text 2>/dev/null || echo ""
)

if [[ -n "$EXISTING_CLIENT_ID" && "$EXISTING_CLIENT_ID" != "None" ]]; then
  ok "App client already exists: $EXISTING_CLIENT_ID — skipping creation"
  CLIENT_ID="$EXISTING_CLIENT_ID"
else
  step "Creating app client"
  CLIENT_ID=$(
    aws cognito-idp create-user-pool-client \
      --user-pool-id "$USER_POOL_ID" \
      --client-name "wobblio-web-local" \
      --no-generate-secret \
      --explicit-auth-flows "ALLOW_USER_PASSWORD_AUTH" "ALLOW_REFRESH_TOKEN_AUTH" \
      $AWS_OPTS \
      --query "UserPoolClient.ClientId" --output text
  )
  ok "App client created: $CLIENT_ID"
fi

# ── Write IDs to config/local.env ─────────────────────────────────────────────
step "Updating config/local.env"
# Use a temp file to avoid sed -i portability issues across macOS/Linux
TMP=$(mktemp)
sed \
  -e "s|^COGNITO_USER_POOL_ID=.*|COGNITO_USER_POOL_ID=$USER_POOL_ID|" \
  -e "s|^COGNITO_CLIENT_ID=.*|COGNITO_CLIENT_ID=$CLIENT_ID|" \
  "$CONFIG_FILE" > "$TMP"
mv "$TMP" "$CONFIG_FILE"
ok "config/local.env updated"

# Keep .env.local files in sync (root + Source/webapp)
cp "$CONFIG_FILE" "$ENV_FILE"
cp "$CONFIG_FILE" "$WEBAPP_ENV_FILE"
ok ".env.local synced (root + Source/webapp)"

# ── Seed test user ────────────────────────────────────────────────────────────
step "Seeding test user: dev@wobblio.local"
TEST_EMAIL="dev@wobblio.local"
TEST_PASSWORD="Dev1234!@#\$"

EXISTING_USER=$(
  aws cognito-idp list-users \
    --user-pool-id "$USER_POOL_ID" \
    --filter "email = \"$TEST_EMAIL\"" \
    $AWS_OPTS \
    --query "Users[0].Username" --output text 2>/dev/null || echo ""
)

if [[ -n "$EXISTING_USER" && "$EXISTING_USER" != "None" ]]; then
  ok "Test user already exists — skipping"
else
  aws cognito-idp admin-create-user \
    --user-pool-id "$USER_POOL_ID" \
    --username "$TEST_EMAIL" \
    --user-attributes "Name=email,Value=$TEST_EMAIL" "Name=email_verified,Value=true" \
    --temporary-password "$TEST_PASSWORD" \
    --message-action SUPPRESS \
    $AWS_OPTS > /dev/null

  # Force-confirm the user so no password change is required on first login
  aws cognito-idp admin-set-user-password \
    --user-pool-id "$USER_POOL_ID" \
    --username "$TEST_EMAIL" \
    --password "$TEST_PASSWORD" \
    --permanent \
    $AWS_OPTS > /dev/null

  ok "Test user created: $TEST_EMAIL / Dev1234!@#\$"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
bold "cognito-local init complete"
printf '  %-25s %s\n' "User Pool ID:"  "$USER_POOL_ID"
printf '  %-25s %s\n' "Client ID:"     "$CLIENT_ID"
printf '  %-25s %s\n' "Test user:"     "$TEST_EMAIL"
printf '  %-25s %s\n' "Password:"      "Dev1234!@#\$"
echo ""
printf '  Run: cd Source/webapp && npm run dev\n'
echo ""
