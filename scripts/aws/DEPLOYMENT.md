# Wobblio — AWS Deployment

Step-by-step guides for deploying Wobblio to dev or production on AWS. For detailed architecture and troubleshooting, see `docs/runbook.md`.

---

## Quick Reference

| Goal | Section |
|---|---|
| Deploy to dev (first time) | [Dev: Initial Deployment](#dev-initial-deployment) |
| Deploy to prod (first time) | [Prod: Initial Deployment](#prod-initial-deployment) |
| Redeploy after code changes | [Redeployment](#redeployment-after-code-changes) |
| Rollback | [Rollback](#rollback) |
| Troubleshooting | [Troubleshooting](#troubleshooting) |

---

## Prerequisites (All Environments)

Before deploying to AWS, verify these are in place:

```bash
# AWS CLI v2 + credentials
aws sts get-caller-identity --profile reuterAdmin
# → Should show your account ID and user ARN

# Node.js 24+, npm 10+
node --version && npm --version

# CDK 2.150.0+
npx cdk --version

# psql for migrations
psql --version

# jq for credential extraction
jq --version
```

---

## Dev: Initial Deployment

Deploy all infrastructure to the `dev` stage for the first time. This includes: database onboarding, AWS bootstrap, CDK stacks, migrations, and the webapp.

### Step 1: Onboard Wobblio onto Shared RDS (one-time)

From the `shared-infra` project directory:

```bash
cd ../shared-infra
./scripts/onboard-app.sh wobblio wobblio_dev
cd ../wobblio
```

This creates (the secret/param are named after the database, so dev and prod stay isolated):
- PostgreSQL role `wobblio_dev_app`
- Database `wobblio_dev` owned by `wobblio_dev_app`
- Secrets Manager secret `shared/db/wobblio_dev`
- SSM parameter `/shared/db/wobblio_dev/secret-arn`

> **Stage convention:** prod uses `shared/db/wobblio` + `/shared/db/wobblio/secret-arn`;
> every non-prod stage uses the underscore-suffixed form `shared/db/wobblio_<stage>`
> (e.g. `wobblio_dev`). The deploy/bootstrap scripts resolve the right one from `$STAGE`.

Verify:
```bash
aws ssm get-parameter --name /shared/db/wobblio_dev/secret-arn \
  --profile reuterAdmin --region eu-west-1 --output text
```

### Step 2: Bootstrap AWS Environment (one-time)

```bash
./scripts/aws/bootstrap.sh --stage dev
```

This:
- Installs PostgreSQL extensions (uuid-ossp, pg_trgm, vector)
- Creates Stripe secret stub

Bootstrap no longer seeds any SSM config. **All** runtime application config (models, quotas,
routing, tags, billing, `ops/email`, `auth/*`, `ai/*`) is owned by `WobblioConfigStack-<stage>`,
created on `cdk deploy` from the committed `config/config.<stage>.json`, under the stage-scoped
prefix `/wobblio/config/<stage>/*`. Edit the JSON (or use the admin console at runtime) — never
`aws ssm put-parameter` by hand.

Verify SSM parameters:
```bash
aws ssm get-parameters-by-path --path /wobblio/config/${STAGE:-dev}/ \
  --profile reuterAdmin --region eu-west-1 --recursive \
  --query "Parameters[].{Name:Name,Value:Value}" --output table
```

### Step 3: CDK Bootstrap (one-time per account)

Bootstrap both regions (CDK needs this before deploying):

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --profile reuterAdmin --query Account --output text)

# eu-west-1 — all application stacks
npx cdk bootstrap aws://${ACCOUNT_ID}/eu-west-1 --profile reuterAdmin

# us-east-1 — ACM certificate for CloudFront
npx cdk bootstrap aws://${ACCOUNT_ID}/us-east-1 --profile reuterAdmin
```

### Step 4: Deploy All Stacks (Automated)

```bash
scripts/aws/deploy.sh --stage dev
```

This script:
- Validates code (hexagonal-architecture-validator, unit tests, cdk synth)
- Deploys all CDK stacks in dependency order
- Runs database migrations
- Builds and deploys the Next.js webapp
- Prints smoke-test commands

**Expected time:** ~10 minutes

#### Stack Deployment Order (if manually deploying)

```bash
cd Source/infra
export AWS_PROFILE=reuterAdmin
export AWS_DEFAULT_REGION=eu-west-1
export CDK_DEFAULT_REGION=eu-west-1
export STAGE=dev

npx cdk deploy WobblioDbStack-${STAGE}            --require-approval never
npx cdk deploy WobblioAuthStack-${STAGE}          --require-approval never
npx cdk deploy WobblioStorageStack-${STAGE}       --require-approval never
npx cdk deploy WobblioObservabilityStack-${STAGE} --require-approval never
npx cdk deploy WobblioBackendStack-${STAGE}       --require-approval never
npx cdk deploy WobblioWebCertStack-${STAGE}       --require-approval never   # us-east-1
npx cdk deploy WobblioWebStack-${STAGE}           --require-approval never
```

### Step 5: Post-Deployment Checks

#### Confirm SNS Email Subscriptions

Check `antonioreuter@gmail.com` inbox for two confirmation emails:
1. **Ops alarm topic** — budget and cost anomaly alerts
2. **Shared DB alarm topic** — RDS health alerts

Click "Confirm subscription" in each email.

#### Check ACM Certificate Status

DNS validation can take up to 30 minutes:

```bash
aws acm list-certificates --region us-east-1 --profile reuterAdmin \
  --query "CertificateSummaryList[?contains(DomainName,'wobblio')].{Domain:DomainName,Status:Status}" \
  --output table
# Expected Status: ISSUED
```

#### Smoke Test Endpoints

```bash
APP_DOMAIN="app.dev.wobblio.com"
API_DOMAIN="api.dev.wobblio.com"

# Waitlist status (public, no auth)
curl -s https://${API_DOMAIN}/waitlist/status
# → {"waitlistActive":false}

# Analytics event (public POST, no auth)
curl -s -X POST https://${API_DOMAIN}/analytics/events \
  -H "Content-Type: application/json" \
  -d '{"event":"hero_cta_click"}'
# → {"ok":true}

# Landing page
curl -sI https://${APP_DOMAIN} | grep "HTTP/"
# → HTTP/2 200
```

✅ **Dev is ready.**

---

## Prod: Initial Deployment

Deploy to production. Same steps as dev, but:
- Use `--stage prod` (not `dev`)
- Domains are `app.wobblio.com` and `api.wobblio.com` (no `.dev`)
- **Update real Stripe keys before going live**

```bash
# Step 1: Onboard (from shared-infra)
cd ../shared-infra
./scripts/onboard-app.sh wobblio wobblio_prod
cd ../wobblio

# Step 2: Bootstrap
./scripts/aws/bootstrap.sh --stage prod

# Step 3: CDK Bootstrap (if not already done)
ACCOUNT_ID=$(aws sts get-caller-identity --profile reuterAdmin --query Account --output text)
npx cdk bootstrap aws://${ACCOUNT_ID}/eu-west-1 --profile reuterAdmin
npx cdk bootstrap aws://${ACCOUNT_ID}/us-east-1 --profile reuterAdmin

# Step 4: Deploy everything
scripts/aws/deploy.sh --stage prod

# Step 5: Same checks as dev (with prod domains)
APP_DOMAIN="app.wobblio.com"
API_DOMAIN="api.wobblio.com"
# ... run curl checks above with prod domains
```

### CRITICAL: Update Stripe Keys Before Going Live

```bash
# Get real keys from Stripe Dashboard → Developers → API Keys
aws secretsmanager update-secret \
  --secret-id wobblio/prod/stripe \
  --secret-string '{"secret_key":"sk_live_...","webhook_secret":"whsec_..."}' \
  --profile reuterAdmin --region eu-west-1
```

---

## Redeployment After Code Changes

After you've deployed once, use these commands for subsequent changes.

### Backend Lambda Code Changed

```bash
export STAGE=dev  # or: prod
cd Source/infra
npx cdk deploy WobblioBackendStack-${STAGE} --profile reuterAdmin --require-approval never
```

### Webapp Code Changed

```bash
export STAGE=dev  # or: prod
source config/${STAGE}.env  # Load APP_DOMAIN and API_DOMAIN

cd Source/webapp
cat > .env.production <<EOF
NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
EOF

npm run build

cd ../infra
npx cdk deploy WobblioWebStack-${STAGE} --profile reuterAdmin --require-approval never
```

Or use the automated script:

```bash
scripts/aws/deploy.sh --stage ${STAGE} --skip-migrations
```

### New Database Migration

```bash
export STAGE=dev  # or: prod

# Stage-aware secret pointer: prod → wobblio, else → wobblio_<stage>
DB_SECRET_PARAM=$([ "$STAGE" = prod ] && echo /shared/db/wobblio/secret-arn || echo /shared/db/wobblio_${STAGE}/secret-arn)

# Retrieve DATABASE_URL from Secrets Manager
SECRET_ARN=$(aws ssm get-parameter \
  --name "$DB_SECRET_PARAM" \
  --profile reuterAdmin --region eu-west-1 \
  --query Parameter.Value --output text)

SECRET_JSON=$(aws secretsmanager get-secret-value \
  --secret-id "$SECRET_ARN" \
  --profile reuterAdmin --region eu-west-1 \
  --query SecretString --output text)

export DATABASE_URL="postgres://$(echo $SECRET_JSON | jq -r .username):$(echo $SECRET_JSON | jq -r .password)@$(echo $SECRET_JSON | jq -r .host):$(echo $SECRET_JSON | jq -r .port)/$(echo $SECRET_JSON | jq -r .dbname)?sslmode=require"

cd Source/infra
npm run migrate:up

# Verify
psql "$DATABASE_URL" -c "SELECT name, run_on FROM pgmigrations ORDER BY run_on DESC LIMIT 5;"
```

### Changing a Config Value

Edit `config/config.<stage>.json` and redeploy the config stack — this keeps the committed
source of truth and the deployed parameters in sync (Lambda picks it up on next cold start):

```bash
export STAGE=dev  # or: prod
cd Source/infra
npx cdk deploy WobblioConfigStack-${STAGE} --profile reuterAdmin --require-approval never
```

For a transient runtime tweak that an operator should make through the product, use the admin
console parameter editor (it writes the stage-scoped param via the audited admin path). Avoid
hand-running `aws ssm put-parameter` — it drifts from `config/config.<stage>.json`.

Or apply all values from `config/${STAGE}.env`:

```bash
./scripts/aws/bootstrap.sh --force-ssm --stage ${STAGE}
```

### Auth / Cognito Config Changed

```bash
export STAGE=dev  # or: prod
cd Source/infra
npx cdk deploy WobblioAuthStack-${STAGE} --profile reuterAdmin --require-approval never
```

### Storage (S3 Buckets) Changed

```bash
export STAGE=dev  # or: prod
cd Source/infra
npx cdk deploy WobblioStorageStack-${STAGE} --profile reuterAdmin --require-approval never
```

### Full Redeploy (All Stacks)

```bash
scripts/aws/deploy.sh --stage ${STAGE}
```

---

## Validation Gates (Run Before Committing)

```bash
# 1. Hexagonal architecture validation (must exit 0)
cd Source/backend && npm run skill:hexagonal-architecture-validator

# 2. Unit tests (all must pass)
cd Source/backend && npm run test:unit

# 3. GDPR/security audit (run when DDL or DB adapters change)
cd Source/backend && npm run validate:security

# 4. CDK synth with cdk-nag (must pass)
cd Source/infra && STAGE=${STAGE:-dev} npm run cdk:synth
```

Or use the Makefile:

```bash
make validate
```

---

## Rollback

### Database Migration Rollback

```bash
cd Source/infra
DATABASE_URL=$DATABASE_URL npm run migrate:down
```

Verify:
```bash
psql "$DATABASE_URL" -c "SELECT name, run_on FROM pgmigrations ORDER BY run_on DESC LIMIT 5;"
```

### Lambda / CDK Stack Rollback

Re-deploy from a previous git commit:

```bash
export STAGE=dev  # or: prod
git checkout <commit-sha>
cd Source/infra
npx cdk deploy WobblioBackendStack-${STAGE} --profile reuterAdmin --require-approval never
```

CloudFormation also supports rollback via the AWS Console (Actions → Roll Back Stack).

### Webapp Rollback

```bash
export STAGE=dev  # or: prod
git checkout <commit-sha>
cd Source/webapp && npm run build
cd ../infra && npx cdk deploy WobblioWebStack-${STAGE} --profile reuterAdmin --require-approval never
```

### CloudFront Fallback URL (If Custom Domain is Broken)

```bash
aws cloudfront list-distributions --profile reuterAdmin \
  --query "DistributionList.Items[?contains(Aliases.Items,'wobblio.com')].DomainName" \
  --output text
# Access via: https://<xxxxxx>.cloudfront.net
```

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `HostedZone not found` during CDK synth | Route53 hosted zone `wobblio.com` missing. Create it first. |
| ACM cert stuck in `PENDING_VALIDATION` | Route53 DNS validation CNAME not created yet. Wait up to 30 min. |
| `Parameter /shared/db/wobblio[_<stage>]/secret-arn not found` | Run onboarding from `shared-infra`: `./scripts/onboard-app.sh wobblio wobblio_<stage>` (e.g. `wobblio_dev` for dev, `wobblio_prod` for prod) |
| Lambda `ECONNREFUSED` or timeout to RDS | Verify the stage secret exists: `aws secretsmanager get-secret-value --secret-id shared/db/wobblio_dev --profile reuterAdmin` (prod: `shared/db/wobblio`) |
| CloudFront 403 on all pages | Re-deploy WebStack: `cdk deploy WobblioWebStack-${STAGE} --profile reuterAdmin` |
| `migrate:up` fails: `role wobblio_app does not exist` | Re-run onboarding from `shared-infra` |
| `CREATE EXTENSION "vector"` fails | PostgreSQL must be ≥ 15.2. Check: `psql "$DATABASE_URL" -c "SHOW server_version;"` |
| AWS credentials not valid | Configure profile: `aws configure --profile reuterAdmin` |
| `cdk synth` fails with cdk-nag errors | Read the error message; add a suppression in the stack CDK code if intentional |

---

## Configuration Reference

### SSM Parameters

Runtime application config lives in `config/config.<stage>.json` and is deployed by
`WobblioConfigStack-<stage>` to the stage-scoped prefix `/wobblio/config/<stage>/*` (the
backend reads the same physical path via `CONFIG_STAGE`). dev and prod share the AWS account,
so the stage prefix keeps their config from colliding. Key parameters (relative key shown):

| Key (under `/wobblio/config/<stage>/`) | Dev | Prod |
|---|---|---|
| `models/vision_parser` | `qwen.qwen3-vl-235b-a22b` | `qwen.qwen3-vl-235b-a22b` |
| `quotas/max_free_waitlist_cap` | `10` | `10` |
| `ops/email` | `antonioreuter@gmail.com` | `antonioreuter@gmail.com` |

Every key is stage-scoped — including `ops/email` (read by the Observability stack) and the
`auth/*` / `ai/*` keys — so dev and prod are fully independent with no shared flat parameters.

To change a value permanently, edit `config/config.<stage>.json` and redeploy the config stack:

```bash
export STAGE=dev  # or: prod
cd Source/infra
npx cdk deploy WobblioConfigStack-${STAGE} --profile reuterAdmin --require-approval never
```

See `docs/runbook.md` §9 for the complete parameter reference.

### S3 Buckets

| Bucket | Stage | Retention | Purpose |
|---|---|---|---|
| `wobblio-uploads-{stage}` | dev, prod | 18 months | Receipt images |
| `wobblio-exports-{stage}` | dev, prod | 7 days | User data exports |
| `wobblio-billing-archive-{stage}` | dev, prod | 7 years | Stripe transaction archive |
| `wobblio-analytics-{stage}` | dev, prod | None | Internal analytics |

### SQS Queues

| Queue | DLQ | Visibility | Max Receives | Purpose |
|---|---|---|---|---|
| `wobblio-ingestion-{stage}` | `wobblio-ingestion-dlq-{stage}` | 30s | 3 | Receipt OCR pipeline |
| `wobblio-analytics-events-{stage}` | `wobblio-analytics-events-dlq-{stage}` | 30s | 3 | Usage metrics |

---

## Quick Commands Cheat Sheet

```bash
# Deployment
scripts/aws/deploy.sh --stage dev                 # Full deployment to dev
scripts/aws/deploy.sh --stage prod                # Full deployment to prod
scripts/aws/deploy.sh --stage dev --skip-webapp   # CDK stacks only (skip webapp)
scripts/aws/deploy.sh --stage dev --skip-migrations  # Skip DB migrations

# Bootstrap
./scripts/aws/bootstrap.sh --stage dev            # One-time AWS bootstrap
./scripts/aws/bootstrap.sh --force-ssm --stage dev  # Force-update SSM params

# Manual CDK
cd Source/infra && export STAGE=dev && npx cdk deploy WobblioBackendStack-${STAGE} --profile reuterAdmin
cd Source/infra && export STAGE=dev && npx cdk deploy WobblioWebStack-${STAGE} --profile reuterAdmin

# Migrations
cd Source/infra && npm run migrate:up
cd Source/infra && npm run migrate:down

# Validation
make validate              # Hexagonal + GDPR + cdk synth
cd Source/backend && npm run test:unit

# Status Checks
aws ssm get-parameters-by-path --path /wobblio/config/${STAGE:-dev}/ --profile reuterAdmin --recursive --output table
aws acm list-certificates --region us-east-1 --profile reuterAdmin --output table
aws cloudfront list-distributions --profile reuterAdmin --output table
```

---

## Next Steps

1. Follow [Dev: Initial Deployment](#dev-initial-deployment) or [Prod: Initial Deployment](#prod-initial-deployment)
2. Read `docs/runbook.md` for detailed architecture and troubleshooting
3. Read `CLAUDE.md` for project rules and security invariants
