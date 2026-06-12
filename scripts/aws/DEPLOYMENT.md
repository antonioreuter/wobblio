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

This creates:
- PostgreSQL role `wobblio_app`
- Database `wobblio_dev` owned by `wobblio_app`
- Secrets Manager secret `shared/db/wobblio`
- SSM parameter `/shared/db/wobblio/secret-arn`

Verify:
```bash
aws ssm get-parameter --name /shared/db/wobblio/secret-arn \
  --profile reuterAdmin --region eu-west-1 --output text
```

### Step 2: Bootstrap AWS Environment (one-time)

```bash
./scripts/aws/bootstrap.sh --stage dev
```

This:
- Installs PostgreSQL extensions (uuid-ossp, pg_trgm, vector)
- Seeds SSM parameters from `config/dev.env`
- Creates Stripe secret stub

Verify SSM parameters:
```bash
aws ssm get-parameters-by-path --path /wobblio/config/ \
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

# Retrieve DATABASE_URL from Secrets Manager
SECRET_ARN=$(aws ssm get-parameter \
  --name /shared/db/wobblio/secret-arn \
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

### SSM Parameter Value Changed (One-Off)

```bash
# Change a single parameter (Lambda picks it up on next cold start)
aws ssm put-parameter \
  --name /wobblio/config/quotas/max_free_waitlist_cap \
  --value "3000" \
  --type String \
  --overwrite \
  --profile reuterAdmin --region eu-west-1
```

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
| `Parameter /shared/db/wobblio/secret-arn not found` | Run onboarding: `cd ../shared-infra && ./scripts/onboard-app.sh wobblio wobblio_prod` |
| Lambda `ECONNREFUSED` or timeout to RDS | Verify Secrets Manager secret exists: `aws secretsmanager get-secret-value --secret-id shared/db/wobblio --profile reuterAdmin` |
| CloudFront 403 on all pages | Re-deploy WebStack: `cdk deploy WobblioWebStack-${STAGE} --profile reuterAdmin` |
| `migrate:up` fails: `role wobblio_app does not exist` | Re-run onboarding from `shared-infra` |
| `CREATE EXTENSION "vector"` fails | PostgreSQL must be ≥ 15.2. Check: `psql "$DATABASE_URL" -c "SHOW server_version;"` |
| AWS credentials not valid | Configure profile: `aws configure --profile reuterAdmin` |
| `cdk synth` fails with cdk-nag errors | Read the error message; add a suppression in the stack CDK code if intentional |

---

## Configuration Reference

### SSM Parameters

All SSM parameters are seeded by `scripts/aws/bootstrap.sh` from `config/${STAGE}.env`. Key parameters:

| Path | Variable | Dev | Prod |
|---|---|---|---|
| `/wobblio/config/models/vision_parser` | `MODEL_VISION_PARSER` | `amazon.nova-lite-v1:0` | `amazon.nova-lite-v1:0` |
| `/wobblio/config/quotas/max_free_waitlist_cap` | `QUOTA_MAX_FREE_WAITLIST_CAP` | `100` | `5000` |
| `/wobblio/config/ai/daily_spend_cap` | `AI_DAILY_SPEND_CAP` | `0.05` | `0.10` |
| `/wobblio/config/ops/email` | `OPS_EMAIL` | `antonioreuter@gmail.com` | `antonioreuter@gmail.com` |

To change a value permanently, edit `config/${STAGE}.env` and re-run:

```bash
./scripts/aws/bootstrap.sh --force-ssm --stage ${STAGE}
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
aws ssm get-parameters-by-path --path /wobblio/config/ --profile reuterAdmin --recursive --output table
aws acm list-certificates --region us-east-1 --profile reuterAdmin --output table
aws cloudfront list-distributions --profile reuterAdmin --output table
```

---

## Next Steps

1. Follow [Dev: Initial Deployment](#dev-initial-deployment) or [Prod: Initial Deployment](#prod-initial-deployment)
2. Read `docs/runbook.md` for detailed architecture and troubleshooting
3. Read `CLAUDE.md` for project rules and security invariants
