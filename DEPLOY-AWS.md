# Wobblio — AWS Deployment Guide

**Region:** `eu-west-1` (all stacks, except `WobblioWebCertStack` which deploys to `us-east-1`)  
**AWS Profile:** `reuterAdmin`  
**Automated script:** `scripts/deploy-aws.sh` (covers Steps 4–6 below)

---

## Architecture Overview

```
                         ┌─────────────────────────────────────────────┐
                         │              eu-west-1                       │
                         │                                              │
 Browser ──► Route53 ──► │ CloudFront ──► S3 (webapp static assets)    │
                         │                                              │
 Browser ──► Route53 ──► │ api.wobblio.com ──► API Gateway ──► Lambda  │
                         │                         │                   │
                         │                         └──► RDS (shared)   │
                         │                                              │
                         │  Cognito  │  SQS  │  SES  │  KMS  │  SNS   │
                         └─────────────────────────────────────────────┘

                         ┌──────────────────────┐
                         │       us-east-1       │
                         │  ACM cert (wobblio.com│
                         │  + www.wobblio.com)   │
                         └──────────────────────┘

                         ┌─────────────────── shared-infra ───────────┐
                         │  RDS PostgreSQL 15 (shared-rds-pg15)        │
                         │  eu-west-1, publicly accessible (TLS only)  │
                         └─────────────────────────────────────────────┘
```

### CDK Stack Deployment Order

| # | Stack | Region | Purpose |
|---|---|---|---|
| 1 | `WobblioDbStack-<stage>` | `eu-west-1` | KMS customer-managed key |
| 2 | `WobblioAuthStack-<stage>` | `eu-west-1` | Cognito User Pool + app clients |
| 3 | `WobblioAppStack-<stage>` | `eu-west-1` | Lambda fleet, API GW, SQS, S3, SES, custom domain |
| 4 | `WobblioWebCertStack-<stage>` | **`us-east-1`** | ACM cert for CloudFront (must be us-east-1) |
| 5 | `WobblioWebStack-<stage>` | `eu-west-1` | S3 + CloudFront + Route53 + webapp deployment |

---

## Prerequisites

Before running any deployment steps, verify the following are in place.

### Tooling

```bash
aws --version           # AWS CLI v2
node --version          # >= 24
npm --version           # >= 10
psql --version          # for running migrations
jq --version            # for credential extraction
npx cdk --version       # >= 2.150.0
```

### AWS credentials

```bash
aws sts get-caller-identity --profile reuterAdmin
# Expected: account ID + arn:aws:iam::<account>:user/...
```

### Route53 hosted zone

`wobblio.com` must have a public hosted zone in Route53 in the `reuterAdmin` account **before** deploying `WobblioAppStack` (for `api.wobblio.com`) and `WobblioWebStack` (for `wobblio.com`).

```bash
aws route53 list-hosted-zones --profile reuterAdmin \
  --query "HostedZones[?Name=='wobblio.com.'].Id" --output text
# Must return a hosted zone ID, e.g. /hostedzone/Z0XXXXXXXXXXXXXXXXX
```

If the hosted zone does not exist, create it first and update your domain registrar's name servers.

---

## Step 1 — Database Setup (one-time per environment)

> Full details: `Source/infra/docs/database-setup.md`

The database lives in the **`shared-infra`** project (a separate CDK project at `../shared-infra`).

### 1a. Verify shared-infra is deployed

```bash
aws ssm get-parameter --name /shared/db/endpoint \
  --profile reuterAdmin --region eu-west-1 \
  --query Parameter.Value --output text
# Must return a hostname like shared-rds-pg15.xxxxxxxxxx.eu-west-1.rds.amazonaws.com
```

If it returns an error, deploy shared-infra first:

```bash
cd ../shared-infra
./deploy.sh   # uses reuterAdmin profile, eu-west-1
```

### 1b. Onboard Wobblio onto the shared RDS (one-time)

```bash
cd ../shared-infra
./scripts/onboard-app.sh wobblio wobblio_prod
```

This creates:
- PostgreSQL role `wobblio_app` with a random password
- Database `wobblio_prod` owned by `wobblio_app`
- Secrets Manager secret `shared/db/wobblio`
- SSM parameter `/shared/db/wobblio/secret-arn`

## Step 2 — AWS Environment & Database Bootstrap (one-time per environment)

Run the unified bootstrap script to install the required PostgreSQL database extensions, seed configuration parameters in SSM, and create the Stripe secret in Secrets Manager:

```bash
# Run for the default prod stage
./scripts/bootstrap-aws.sh

# Or run for a specific stage (e.g. dev)
./scripts/bootstrap-aws.sh --stage dev
```

> [!NOTE]
> The script will skip creating parameters or secrets that already exist, preventing accidental overrides of custom configurations or real keys. To force-update SSM parameters or Stripe secrets, run with `--force-ssm` or `--force-stripe`.
>
> **Action Required:** The Stripe secret `wobblio/<stage>/stripe` is initialized with dummy values. Before running transactional backend code, update it with your real Stripe keys (from Stripe Dashboard -> API Keys).

Verify parameters and database extensions:
```bash
# Verify SSM config parameters
aws ssm get-parameters-by-path --path /wobblio/config/ \
  --profile reuterAdmin --region eu-west-1 --recursive \
  --query "Parameters[].{Name:Name,Value:Value}" --output table

# Verify DB extensions
psql "host=$DB_HOST port=5432 user=postgres password=$MASTER_PASS \
      dbname=wobblio_prod sslmode=require" \
  -c "SELECT extname, extversion FROM pg_extension WHERE extname IN ('uuid-ossp','pg_trgm','vector');"
```

---

## Step 3 — CDK Bootstrap (one-time per account/region)

Bootstrap must run in **both regions** because `WobblioWebCertStack` deploys to `us-east-1`.

```bash
# eu-west-1 (all app stacks)
npx cdk bootstrap aws://<ACCOUNT_ID>/eu-west-1 \
  --profile reuterAdmin

# us-east-1 (WobblioWebCertStack — ACM cert for CloudFront)
npx cdk bootstrap aws://<ACCOUNT_ID>/us-east-1 \
  --profile reuterAdmin
```

Find your account ID:
```bash
aws sts get-caller-identity --profile reuterAdmin --query Account --output text
```

---

## Step 4 — Deploy CDK Stacks

> Run the automated script for Steps 4–6: `scripts/deploy-aws.sh`
> Or follow the manual steps below.

```bash
cd Source/infra
export AWS_PROFILE=reuterAdmin
export AWS_DEFAULT_REGION=eu-west-1
export CDK_DEFAULT_REGION=eu-west-1
export STAGE=prod

# 1. KMS key
npx cdk deploy WobblioDbStack-prod \
  --profile reuterAdmin --require-approval never

# 2. Cognito User Pool
npx cdk deploy WobblioAuthStack-prod \
  --profile reuterAdmin --require-approval never

# 3. Lambda fleet + API Gateway + custom domain api.wobblio.com
npx cdk deploy WobblioAppStack-prod \
  --profile reuterAdmin --require-approval never

# 4. ACM certificate in us-east-1 (required before WobblioWebStack)
npx cdk deploy WobblioWebCertStack-prod \
  --profile reuterAdmin --require-approval never

# 5. S3 + CloudFront + Route53 (deploys webapp)
#    Build the webapp first — see Step 5
npx cdk deploy WobblioWebStack-prod \
  --profile reuterAdmin --require-approval never
```

**After deploying `WobblioAuthStack`:** confirm the SNS email subscription sent to `antonioreuter@gmail.com`.

---

## Step 5 — Run Database Migrations

Migrations run via `node-pg-migrate`. Fetch credentials from Secrets Manager first:

```bash
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
```

Expected output:
```
> node-pg-migrate up
Migrating files:
  20260611152000_initial-schema
  20260611170000_auth-rls-helpers
Migrations complete!
```

Verify:
```bash
psql "$DATABASE_URL" -c "SELECT name, run_on FROM pgmigrations ORDER BY run_on;"
```

---

## Step 6 — Build and Deploy the Webapp

The webapp is a Next.js static export deployed to S3 via `WobblioWebStack`.

```bash
cd Source/webapp

# Set production environment variables
cat > .env.production <<'EOF'
NEXT_PUBLIC_API_BASE_URL=https://api.wobblio.com
NEXT_PUBLIC_SITE_URL=https://wobblio.com
EOF

# Build static export → Source/webapp/out/
npm run build

# The out/ directory is now present.
# Re-deploy WobblioWebStack to sync out/ to S3 and invalidate CloudFront.
cd ../../Source/infra
STAGE=prod npx cdk deploy WobblioWebStack-prod \
  --profile reuterAdmin --require-approval never
```

---

## Step 7 — Post-Deployment Checks

### DNS propagation

ACM certificates use DNS validation. Allow up to 30 minutes for Route53 to validate.
Monitor in the AWS Console → ACM → `wobblio.com`.

```bash
# Check certificate status
aws acm list-certificates --region us-east-1 --profile reuterAdmin \
  --query "CertificateSummaryList[?DomainName=='wobblio.com'].{Status:Status,Arn:CertificateArn}" \
  --output table
```

### Smoke test endpoints

```bash
# Waitlist status (public, should return JSON)
curl -s https://api.wobblio.com/waitlist/status
# → {"waitlistActive":false}

# Analytics event (public, should return 200)
curl -s -X POST https://api.wobblio.com/analytics/events \
  -H "Content-Type: application/json" \
  -d '{"event":"hero_cta_click"}'
# → {"ok":true}

# Landing page
curl -sI https://wobblio.com | grep "HTTP/"
# → HTTP/2 200

# www redirect
curl -sI https://www.wobblio.com | grep -E "HTTP/|location"
# → HTTP/2 200 (or 301 to apex)
```

### CloudFront distribution

```bash
aws cloudfront list-distributions --profile reuterAdmin \
  --query "DistributionList.Items[?contains(Aliases.Items,'wobblio.com')].{Id:Id,Status:Status,Domain:DomainName}" \
  --output table
```

### Lambda cold-start test

```bash
# Invoke waitlist-status Lambda directly
FUNCTION_NAME=$(aws lambda list-functions --profile reuterAdmin --region eu-west-1 \
  --query "Functions[?contains(FunctionName,'waitlist-status')].FunctionName" \
  --output text)

aws lambda invoke --function-name "$FUNCTION_NAME" \
  --payload '{}' --profile reuterAdmin --region eu-west-1 \
  /tmp/lambda-response.json && cat /tmp/lambda-response.json
```

### SNS email subscriptions

Two subscriptions require manual confirmation (check `antonioreuter@gmail.com`):
1. **Ops alarm topic** (from `WobblioAppStack`) — budget and cost anomaly alerts
2. **Shared DB alarm topic** (from `shared-infra`) — RDS health alerts

---

## Step 8 — Cognito Post-Deployment Configuration

After `WobblioAuthStack` deploys, note the User Pool ID and client IDs from the CDK outputs:

```bash
aws cloudformation describe-stacks \
  --stack-name WobblioAuthStack-prod \
  --profile reuterAdmin --region eu-west-1 \
  --query "Stacks[0].Outputs[*].{Key:OutputKey,Value:OutputValue}" \
  --output table
```

Configure Google and Meta (Facebook) federation in the Cognito console, or via CLI, using the OAuth client IDs/secrets from each provider. This is a one-time manual step as federation credentials are not managed in CDK.

---

## Re-deploy Checklist (subsequent deploys)

| Changed area | Command |
|---|---|
| Backend Lambda code only | `cd Source/infra && STAGE=prod npx cdk deploy WobblioAppStack-prod --profile reuterAdmin` |
| Webapp only | Build `Source/webapp`, then re-deploy `WobblioWebStack-prod` |
| New DB migration | Set `DATABASE_URL`, then `cd Source/infra && npm run migrate:up` |
| SSM parameter change | `aws ssm put-parameter ...` — Lambda picks it up on next cold start |
| Auth changes | `STAGE=prod npx cdk deploy WobblioAuthStack-prod --profile reuterAdmin` |
| All stacks | `scripts/deploy-aws.sh` |

---

## Rollback

```bash
# Roll back a migration
cd Source/infra && npm run migrate:down

# Roll back a CDK stack to a previous state
cd Source/infra
STAGE=prod npx cdk deploy WobblioAppStack-prod \
  --profile reuterAdmin --require-approval never
# (re-deploy from the previous git commit)

# CloudFront URL in case custom domain is broken
aws cloudfront list-distributions --profile reuterAdmin \
  --query "DistributionList.Items[?contains(Aliases.Items,'wobblio.com')].DomainName" \
  --output text
```

---

## Troubleshooting

**`HostedZone not found` during CDK synth**
→ Ensure `wobblio.com` has a public hosted zone in Route53 in the `reuterAdmin` account.
→ Run: `aws route53 list-hosted-zones --profile reuterAdmin --query "HostedZones[?Name=='wobblio.com.']"`

**ACM certificate stuck in `PENDING_VALIDATION`**
→ Route53 DNS validation records are created automatically by CDK. Allow up to 30 min.
→ Check the cert's DNS CNAME records exist in Route53.

**`Parameter /shared/db/wobblio/secret-arn` not found**
→ Run Step 1b (`onboard-app.sh wobblio wobblio_prod`) from the `shared-infra` project.

**Lambda cannot connect to RDS (`ECONNREFUSED` or timeout)**
→ Confirm `shared/db/wobblio` secret exists and contains correct `host`/`port`/`dbname`.
→ Confirm the RDS instance is running: `cd ../shared-infra && ./manage-db-cluster.sh status`

**CloudFront 403 on all pages**
→ S3 OAC policy — re-deploy `WobblioWebStack-prod` (CDK regenerates the bucket policy).
→ Check that `BucketDeployment` ran and `out/` was not empty.

**`migrate:up` fails with `role wobblio_app does not exist`**
→ Re-run `onboard-app.sh wobblio wobblio_prod` from shared-infra.

**`CREATE EXTENSION "vector"` fails**
→ RDS must be PostgreSQL 15.2+. Check: `psql "$DATABASE_URL" -c "SHOW server_version;"`.
→ Must run as `postgres` (master), not `wobblio_app`.
