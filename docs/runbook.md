# Wobblio — Operational & Maintenance Runbook

**Audience:** DevOps engineers and developers  
**AWS Profile:** `reuterAdmin`  
**Primary region:** `eu-west-1` (all stacks except ACM cert)  
**Secondary region:** `us-east-1` (ACM cert for CloudFront only)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Prerequisites](#3-prerequisites)
4. [Environment Configuration Files](#4-environment-configuration-files)
5. [Local Development Setup](#5-local-development-setup)
6. [Greenfield AWS Deployment](#6-greenfield-aws-deployment)
7. [Re-deploy Checklist](#7-re-deploy-checklist)
8. [Database Operations](#8-database-operations)
9. [Configuration Reference](#9-configuration-reference)
10. [Lambda Fleet & API Reference](#10-lambda-fleet--api-reference)
11. [Monitoring & Alerting](#11-monitoring--alerting)
12. [Rollback Procedures](#12-rollback-procedures)
13. [Troubleshooting](#13-troubleshooting)
14. [Security & Compliance Notes](#14-security--compliance-notes)

---

## 1. Overview

Wobblio is a cloud-native personal fiscal management utility. Receipt photographs are converted into structured financial data via AWS Bedrock multimodal AI. Anonymized price observations feed a crowdsourced regional price index that powers differentiating features (Anti-Inflation Price Engine, Split-Route Shopping Optimizer).

### Tech Stack

| Layer | Technology |
|---|---|
| Web frontend | Next.js (static export) + Tailwind CSS |
| Mobile | Flutter — backlog, not yet implemented |
| Backend compute | AWS Lambda (Node.js 24, ARM64), API Gateway REST |
| Messaging | Amazon SQS (ingestion + analytics) |
| Database | Amazon RDS PostgreSQL 15 (shared `shared-infra` instance, `db.t3.micro`) |
| AI | AWS Bedrock Converse — vision, auxiliary, insight, embedder models |
| Object storage | Amazon S3 (4 buckets per stage) |
| Auth | Amazon Cognito User Pool + JWT authorizer (Google/Meta federation) |
| Payments | Stripe Checkout + webhooks (web only, no in-app purchase) |
| IaC | AWS CDK v2 / TypeScript, gated by `cdk-nag` |
| Encryption | AWS KMS customer-managed key (CMK), AES-GCM envelope encryption |
| DNS / CDN | Route53 + CloudFront |

### Stage Domains

| Stage | Webapp | API |
|---|---|---|
| `prod` | `app.wobblio.com` | `api.wobblio.com` |
| `dev` | `app.dev.wobblio.com` | `api.dev.wobblio.com` |
| `local` | `http://localhost:3000` | `http://localhost:3001` |

### Key Contacts

| Role | Value |
|---|---|
| AWS account | `reuterAdmin` profile |
| Ops email | `antonioreuter@gmail.com` |
| Domain registrar | Route53 hosted zone `wobblio.com` |

---

## 2. Architecture

### 2.1 Infrastructure Topology

```mermaid
graph TD
  subgraph Internet
    Browser["Browser / Mobile App"]
  end

  subgraph Route53["Route53 (wobblio.com)"]
    DNS_APP["app[.dev].wobblio.com"]
    DNS_API["api[.dev].wobblio.com"]
  end

  subgraph us_east_1["AWS — us-east-1"]
    ACM["ACM Certificate\napp[.dev].wobblio.com\n(CloudFront requirement)"]
    SSM_CERT["SSM\n/wobblio/web/{stage}/certificate-arn"]
  end

  subgraph eu_west_1["AWS — eu-west-1"]
    subgraph CDN["Web Hosting"]
      CF["CloudFront Distribution\nGeo: EU/EEA+UK only\nPrice Class 100"]
      S3_WEB["S3 Web Assets\n(static Next.js export)"]
    end

    subgraph API_Layer["API Layer"]
      APIGW["API Gateway REST\nCognito JWT authorizer\n50 burst / 20 req·s⁻¹"]
    end

    subgraph Compute["Lambda Fleet (Node 24 ARM64, 512 MB, 30 s)"]
      L_API["api-handler\n×25 concurrent"]
      L_ING["ingestion-worker\n×5 concurrent"]
      L_BUDGET["cron-budget-reset\n×2 Mon 00:00 UTC"]
      L_FX["cron-fx-rate-fetch\n×2 Daily 06:05 UTC"]
      L_WL["cron-waitlist-release\n×2 Mon 08:00 UTC"]
      L_STATUS["waitlist-status\n×5 public"]
      L_ANALYTICS["analytics-events\n×5 public"]
    end

    subgraph Messaging["Messaging"]
      SQS_ING["SQS ingestion\n+ DLQ"]
      SQS_ANL["SQS analytics-events\n+ DLQ"]
    end

    subgraph Storage["S3 Buckets"]
      S3_UP["uploads\n18-month lifecycle"]
      S3_EX["exports\n7-day lifecycle"]
      S3_BA["billing-archive\n7-year lifecycle\nGlacier @90d"]
      S3_AN["analytics\nno lifecycle"]
    end

    subgraph Auth["Auth"]
      COGNITO["Cognito User Pool\n+ Google/Meta federation"]
    end

    subgraph Observability["Observability"]
      SNS["SNS ops topic"]
      BUDGETS["AWS Budgets\n€30/month"]
      CAD["Cost Anomaly Detection\n>€10/day"]
      CW["CloudWatch Logs\n3-day retention"]
    end

    KMS["KMS CMK\n(WobblioDbStack)"]
    BEDROCK["AWS Bedrock\nVision · Haiku · Sonnet · Titan V2"]
    SES["SES\nwobblio.com domain"]
    EB["EventBridge\ncron rules"]
  end

  subgraph shared_infra["shared-infra (separate repo)"]
    RDS["RDS PostgreSQL 15\ndb.t3.micro\nTLS-only public endpoint"]
    SSM_DB["SSM /shared/db/*\nSecrets Manager shared/db/wobblio"]
  end

  Browser --> DNS_APP --> CF --> S3_WEB
  Browser --> DNS_API --> APIGW
  ACM --> SSM_CERT --> CF
  APIGW --> L_API
  APIGW --> L_STATUS
  APIGW --> L_ANALYTICS
  L_API --> SQS_ING
  L_API --> SQS_ANL
  L_ANALYTICS --> SQS_ANL
  SQS_ING --> L_ING
  L_ING --> BEDROCK
  L_ING --> RDS
  L_API --> RDS
  L_ING --> S3_UP
  L_ING --> S3_AN
  L_API --> S3_EX
  L_API --> S3_BA
  EB --> L_BUDGET
  EB --> L_FX
  EB --> L_WL
  L_WL --> SES
  RDS -.->|SSM params| SSM_DB
  SSM_DB -.-> L_API
  SSM_DB -.-> L_ING
  COGNITO --> APIGW
  KMS --> S3_UP & S3_EX & S3_BA & S3_AN
  KMS --> SQS_ING & SQS_ANL
  SNS --> BUDGETS & CAD
```

### 2.2 CDK Stack Dependency Graph

```mermaid
graph TD
  DbStack["WobblioDbStack\neu-west-1\nKMS CMK"]
  AuthStack["WobblioAuthStack\neu-west-1\nCognito User Pool"]
  StorageStack["WobblioStorageStack\neu-west-1\nS3 × 4"]
  ObsStack["WobblioObservabilityStack\neu-west-1\nSNS · Budgets · CAD"]
  BackendStack["WobblioBackendStack\neu-west-1\nLambda × 7 · API GW · SQS"]
  CertStack["WobblioWebCertStack\nus-east-1\nACM Certificate"]
  WebStack["WobblioWebStack\neu-west-1\nS3 · CloudFront · Route53"]

  DbStack --> AuthStack
  DbStack --> StorageStack
  DbStack --> ObsStack
  AuthStack --> BackendStack
  StorageStack --> BackendStack
  ObsStack --> BackendStack
  BackendStack --> WebStack
  CertStack --> WebStack
```

**Deployment order:** DbStack → AuthStack + StorageStack + ObsStack (parallel) → BackendStack → CertStack (parallel, us-east-1) → WebStack

### 2.3 Database Architecture

The PostgreSQL instance lives in the **`shared-infra`** repository (`../shared-infra`). Wobblio shares this RDS instance with other apps; each app gets its own role and database.

```mermaid
graph LR
  subgraph shared_infra["shared-infra repo"]
    RDS["RDS PostgreSQL 15\ndb.t3.micro"]
    SM["Secrets Manager\nshared/db/wobblio"]
    SSM["SSM /shared/db/wobblio/secret-arn\nSSM /shared/db/endpoint"]
  end

  subgraph wobblio_db["wobblio_prod / wobblio_dev"]
    ROLE["role: wobblio_app"]
    SCHEMA["32 tables\n14 RLS-protected\n18 global/anonymized"]
    EXT["Extensions:\nuuid-ossp · pg_trgm · pgvector"]
  end

  RDS --> wobblio_db
  SM --> SSM
  SSM -.->|read at deploy/runtime| SCHEMA
```

**Connection budget (db.t3.micro, ~85 connections available):**

| Consumer | Reserved concurrency | Max DB connections |
|---|---|---|
| api-handler Lambda | 25 | 25 |
| ingestion-worker Lambda | 5 | 5 |
| cron Lambdas (3×) | 2 each | 6 |
| **Total** | | **~36** |

---

## 3. Prerequisites

### 3.1 Required Tooling

```bash
aws --version       # AWS CLI v2+
node --version      # >= 24
npm --version       # >= 10
psql --version      # PostgreSQL client (for migrations)
jq --version        # JSON processor
npx cdk --version   # >= 2.150.0
```

### 3.2 AWS Credentials

Configure the `reuterAdmin` profile:

```bash
aws configure --profile reuterAdmin
# Enter: Access Key ID, Secret Access Key, Region (eu-west-1), output (json)
```

Verify:

```bash
aws sts get-caller-identity --profile reuterAdmin
# Expected: {"Account": "<account-id>", "Arn": "arn:aws:iam::<account-id>:user/..."}
```

### 3.3 Route53 Hosted Zone

`wobblio.com` must have a **public hosted zone** in the `reuterAdmin` account before deploying `WobblioBackendStack` or `WobblioWebStack`.

```bash
aws route53 list-hosted-zones --profile reuterAdmin \
  --query "HostedZones[?Name=='wobblio.com.'].Id" --output text
# Must return: /hostedzone/Z0XXXXXXXXXXXXXXXXX
```

If missing, create the hosted zone and update your domain registrar's nameservers.

### 3.4 Shared Infrastructure

The RDS instance is managed by a separate project. Verify it is deployed:

```bash
aws ssm get-parameter --name /shared/db/endpoint \
  --profile reuterAdmin --region eu-west-1 \
  --query Parameter.Value --output text
# Must return: shared-rds-pg15.xxxxxxxxxx.eu-west-1.rds.amazonaws.com
```

If it returns an error, deploy `shared-infra` first:

```bash
cd ../shared-infra
./deploy.sh   # uses reuterAdmin profile, eu-west-1
```

---

## 4. Environment Configuration Files

All environment-specific, non-sensitive configuration lives in the `config/` directory. Every script sources the appropriate file automatically — there is nothing to fill in manually.

```
config/
  local.env   ← fully local (Docker + LocalStack), mock credentials only
  dev.env     ← dev AWS stage, non-sensitive values only
  prod.env    ← prod AWS stage, non-sensitive values only
```

Sensitive values (real DB credentials, live Stripe keys) are **never** in these files. They live in AWS Secrets Manager and are fetched at runtime by the bootstrap and deploy scripts.

### 4.1 File Purpose and Consumer

| File | Sourced by | When |
|---|---|---|
| `config/local.env` | `scripts/local/bootstrap.sh` | Local bootstrap |
| `config/local.env` | `scripts/local/deploy.sh` | `make deploy` |
| `config/local.env` | `Makefile` (`include config/local.env`) | All `make` targets |
| `config/dev.env` | `scripts/aws/bootstrap.sh --stage dev` | AWS dev bootstrap |
| `config/dev.env` | `scripts/aws/deploy.sh --stage dev` | AWS dev deploy |
| `config/prod.env` | `scripts/aws/bootstrap.sh` | AWS prod bootstrap |
| `config/prod.env` | `scripts/aws/deploy.sh` | AWS prod deploy |

### 4.2 Key Differences Between Stages

| Variable | `local.env` | `dev.env` | `prod.env` |
|---|---|---|---|
| `STAGE` | `local` | `dev` | `prod` |
| `AWS_ENDPOINT_URL` | `http://localhost:4566` | *(not set — real AWS)* | *(not set — real AWS)* |
| `DATABASE_URL` | Docker Postgres (no SSL) | *(fetched from Secrets Manager)* | *(fetched from Secrets Manager)* |
| `QUOTA_MAX_FREE_WAITLIST_CAP` | `5000` | `100` | `5000` |
| `AI_DAILY_SPEND_CAP` | `0.10` | `0.05` | `0.10` |
| `BUDGET_LIMIT_EUR` | `10` | `10` | `30` |
| `BILLING_MOCK_PREMIUM_WHITELIST` | `antonioreuter@gmail.com` | `antonioreuter@gmail.com` | `-` (disabled) |
| `MODEL_VISION_PARSER` | `mock-vision-model` | `amazon.nova-lite-v1:0` | `amazon.nova-lite-v1:0` |

### 4.3 `.env.local` — Auto-Generated File

`.env.local` is a copy of `config/local.env` maintained for tooling (Next.js, Jest) that expects it at the repo root. It is **not** edited directly.

```bash
# Generates .env.local from config/local.env (run once)
make setup

# scripts/local/bootstrap.sh also syncs it automatically
make bootstrap
```

To add a local-only override (e.g. a real Stripe test key), append it to `.env.local` after generation — it is gitignored.

---

## 5. Local Development Setup

Local development runs **entirely on your machine** — no AWS account or credentials required.

| Service | Emulator | Address |
|---|---|---|
| S3, SQS, SSM, Secrets Manager | LocalStack 3 | `http://localhost:4566` |
| PostgreSQL 15 + pgvector | Docker (`pgvector/pgvector:pg15`) | `localhost:5432` |
| Backend API | Local Node process | `http://localhost:3001` |
| Webapp | Next.js dev server | `http://localhost:3000` |

AWS SDK calls are transparently redirected to LocalStack via `AWS_ENDPOINT_URL=http://localhost:4566`. Cognito and Bedrock are mocked at the port layer in unit tests.

### 5.1 Prerequisites

| Tool | Version |
|---|---|
| Node.js | ≥ 24 |
| Docker Desktop | latest |

No AWS credentials needed.

### 5.2 First-Time Setup

```bash
# 1. Create symlinks + copy pre-filled .env.local (no edits required)
make setup

# 2. Full one-time bootstrap: Docker + extensions + LocalStack CDK + migrations + seed
make bootstrap

# 3. Start the webapp
cd Source/webapp && npm run dev
# Webapp: http://localhost:3000
# API:    http://localhost:3001
```

After the initial bootstrap, subsequent starts only need:
```bash
docker compose -f scripts/local/docker-compose.yml up -d
cd Source/webapp && npm run dev
```

### 5.3 Bootstrap Script

`scripts/local/bootstrap.sh` mirrors the AWS bootstrap (`scripts/aws/bootstrap.sh`) and runs six phases:

| Phase | Action |
|---|---|
| 1 | `docker compose up -d --wait` — starts LocalStack + Postgres, waits for health checks |
| 2 | Installs `uuid-ossp`, `pg_trgm`, `vector` extensions on local Postgres |
| 3 | `npm install` in `Source/backend` and `Source/infra` |
| 4 | `cdklocal deploy WobblioLocalBootstrapStack-local` — creates S3 buckets, SQS queues, SSM parameters, Secrets Manager stubs in LocalStack |
| 5 | `npm run migrate:up` — applies pending migrations to local Postgres |
| 6 | `npm run seed:local` — seeds merchants, product taxonomy, and SSM parameters |

Available flags:

| Flag | Effect |
|---|---|
| `--skip-docker` | Skip starting Docker services (assume already running) |
| `--skip-cdk` | Skip `cdklocal` deploy (LocalStack already bootstrapped) |
| `--skip-db` | Skip extensions and migrations |
| `--skip-seed` | Skip reference data seed |
| `--force-seed` | Re-seed even if merchants already present |

### 5.4 `.env.local` Reference

`make setup` (and `make bootstrap`) copies `config/local.env` → `.env.local`. All values are pre-filled; no manual editing is needed. See §4 for the full config file description.

| Variable | Value | Notes |
|---|---|---|
| `STAGE` | `local` | Activates `WobblioLocalBootstrapStack` and LocalStack endpoints |
| `AWS_ENDPOINT_URL` | `http://localhost:4566` | Redirects all AWS SDK calls to LocalStack |
| `AWS_ACCESS_KEY_ID` | `test` | LocalStack accepts any non-empty value |
| `AWS_SECRET_ACCESS_KEY` | `test` | LocalStack accepts any non-empty value |
| `DATABASE_URL` | `postgres://wobblio_dev:wobblio_dev_secret@localhost:5432/wobblio_local` | Local Postgres, no SSL |
| `S3_UPLOADS_BUCKET` | `wobblio-uploads-local` | Created by `WobblioLocalBootstrapStack` |
| `SQS_INGESTION_QUEUE_URL` | `http://localhost:4566/000000000000/wobblio-ingestion-local` | LocalStack SQS |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:3001` | Local API |
| `STRIPE_SECRET_KEY` | `sk_test_mock_local` | Mock — seeded by `WobblioLocalBootstrapStack` |

### 5.5 Docker Services

```bash
# Start
docker compose -f scripts/local/docker-compose.yml up -d

# Status
docker compose -f scripts/local/docker-compose.yml ps

# Stop (data persists in named volumes)
docker compose -f scripts/local/docker-compose.yml stop

# Full reset (wipes Postgres data + LocalStack state)
docker compose -f scripts/local/docker-compose.yml down -v && make deploy
```

### 5.6 `make` Targets

| Target | Script invoked | Description |
|---|---|---|
| `make setup` | inline | Create `backend/` + `infra/` symlinks; sync `config/local.env` → `.env.local` |
| `make bootstrap` | `scripts/local/bootstrap.sh` | Full one-time bootstrap: Docker + extensions + LocalStack CDK + migrations + seed |
| `make deploy` | `scripts/local/deploy.sh` | Lighter re-run: start Docker, re-deploy LocalStack CDK stack, run pending migrations |
| `make migrate` | inline (`npm run migrate:up`) | Run pending DB migrations against local Postgres |
| `make validate` | inline | Hexagonal architecture validator + GDPR security auditor |
| `make help` | inline | List all available targets |

### 5.7 Running Tests

```bash
# Unit tests — mocked ports, zero network calls
cd Source/backend && npm run test:unit

# Hexagonal architecture validation
cd Source/backend && npm run skill:hexagonal-architecture-validator

# GDPR/security audit (run when DDL or DB adapters change)
cd Source/backend && npm run validate:security

# CDK synth with cdk-nag (local stage)
cd Source/infra && STAGE=local npm run cdk:synth
```

### 5.8 Local Troubleshooting

| Symptom | Resolution |
|---|---|
| `Docker is not running` | Start Docker Desktop, retry `make deploy` |
| LocalStack health check fails | `docker compose … logs localstack`; check port 4566 is free |
| Postgres health check fails | `docker compose … logs postgres`; check port 5432 is free |
| `cdklocal: command not found` | Run `npm install` inside `Source/infra` |
| `migrate:up` connection error | Confirm Postgres container is healthy: `docker compose … ps postgres` |
| SSM parameters not found | Re-run `make deploy` (Step 3 re-deploys `WobblioLocalBootstrapStack`) |

---

## 6. Greenfield AWS Deployment

Follow these steps **in order** when deploying into a brand-new AWS account or new stage for the first time.

### Step 1 — Verify Shared Infrastructure

```bash
aws ssm get-parameter --name /shared/db/endpoint \
  --profile reuterAdmin --region eu-west-1 \
  --query Parameter.Value --output text
```

Expected output: `shared-rds-pg15.xxxxxxxxxx.eu-west-1.rds.amazonaws.com`

If missing → deploy `shared-infra` first (see §3.4).

### Step 2 — Onboard Wobblio onto Shared RDS

Run once per environment from the `shared-infra` project directory:

```bash
cd ../shared-infra

# For prod
./scripts/onboard-app.sh wobblio wobblio_prod

# For dev
./scripts/onboard-app.sh wobblio wobblio_dev
```

This creates:
- PostgreSQL role `wobblio_app` with a random 32-char password
- Database `wobblio_prod` (or `wobblio_dev`) owned by `wobblio_app`
- Secrets Manager secret `shared/db/wobblio`
- SSM parameter `/shared/db/wobblio/secret-arn`

Verify:

```bash
aws ssm get-parameter --name /shared/db/wobblio/secret-arn \
  --profile reuterAdmin --region eu-west-1 --output text
```

### Step 3 — Bootstrap AWS Environment

Run once per stage. Loads `config/${STAGE}.env`, installs PostgreSQL extensions, seeds all SSM parameters from the config file, and creates the Stripe secret stub.

```bash
# Production (default) — loads config/prod.env
./scripts/aws/bootstrap.sh

# Development — loads config/dev.env
./scripts/aws/bootstrap.sh --stage dev
```

The script sources the matching `config/<stage>.env` automatically. All SSM parameter values (model IDs, quotas, routing, AI caps, ops email) come from that file — to change a value for a future bootstrap, edit the config file, not the script.

> **Important:** The Stripe secret (`wobblio/<stage>/stripe`) is initialized with placeholder values. Before running transactional code, update it with real keys from the Stripe Dashboard → API Keys.

Available flags:

| Flag | Effect |
|---|---|
| `--stage <dev\|prod>` | Target stage — determines which config file is loaded (default: `prod`) |
| `--skip-db` | Skip PostgreSQL extension installation |
| `--skip-ssm` | Skip SSM parameter seeding |
| `--skip-stripe` | Skip Stripe secret creation |
| `--force-ssm` | Overwrite existing SSM parameters (otherwise skips if already set) |
| `--force-stripe` | Overwrite existing Stripe secret |

Verify SSM parameters were created:

```bash
aws ssm get-parameters-by-path --path /wobblio/config/ \
  --profile reuterAdmin --region eu-west-1 --recursive \
  --query "Parameters[].{Name:Name,Value:Value}" --output table
```

Verify PostgreSQL extensions:

```bash
# Retrieve DATABASE_URL first (see §7.1), then:
psql "$DATABASE_URL" -c \
  "SELECT extname, extversion FROM pg_extension WHERE extname IN ('uuid-ossp','pg_trgm','vector');"
```

### Step 4 — CDK Bootstrap (both regions, one-time per account)

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --profile reuterAdmin --query Account --output text)

# eu-west-1 — all application stacks
npx cdk bootstrap aws://${ACCOUNT_ID}/eu-west-1 --profile reuterAdmin

# us-east-1 — WobblioWebCertStack (ACM cert for CloudFront)
npx cdk bootstrap aws://${ACCOUNT_ID}/us-east-1 --profile reuterAdmin
```

### Step 5 — Deploy All CDK Stacks

#### Automated (recommended)

```bash
# Deploy everything to dev — loads config/dev.env automatically
scripts/aws/deploy.sh --stage dev

# Deploy everything to prod — loads config/prod.env automatically
scripts/aws/deploy.sh --stage prod

# CDK stacks only, skip webapp build
scripts/aws/deploy.sh --stage dev --skip-webapp

# CDK stacks only, skip DB migrations
scripts/aws/deploy.sh --stage dev --skip-migrations
```

The script sources `config/${STAGE}.env` at startup (stage domains, model IDs, ops email). It then runs preflight checks, installs dependencies, runs validation gates (hexagonal-architecture-validator, unit tests, `cdk synth`), deploys all stacks in dependency order, runs migrations, builds the webapp using `NEXT_PUBLIC_*` values from the config file, and prints smoke-test commands.

Available flags:

| Flag | Effect |
|---|---|
| `--stage <dev\|prod>` | Target stage — determines which config file is loaded (default: `prod`) |
| `--skip-webapp` | Skip Next.js build + `WobblioWebStack` deploy |
| `--skip-migrations` | Skip database migrations |

#### Manual (stack-by-stack)

```bash
cd Source/infra
export AWS_PROFILE=reuterAdmin
export AWS_DEFAULT_REGION=eu-west-1
export CDK_DEFAULT_REGION=eu-west-1
export STAGE=dev   # or: prod

npx cdk deploy WobblioDbStack-${STAGE}            --require-approval never
npx cdk deploy WobblioAuthStack-${STAGE}          --require-approval never
npx cdk deploy WobblioStorageStack-${STAGE}       --require-approval never
npx cdk deploy WobblioObservabilityStack-${STAGE} --require-approval never
npx cdk deploy WobblioBackendStack-${STAGE}       --require-approval never
npx cdk deploy WobblioWebCertStack-${STAGE}       --require-approval never   # deploys to us-east-1
npx cdk deploy WobblioWebStack-${STAGE}           --require-approval never
```

### Step 6 — Run Database Migrations

```bash
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
```

Expected output:
```
Migrating files:
  20260611152000_initial-schema
  20260611170000_auth-rls-helpers
Migrations complete!
```

Verify:
```bash
psql "$DATABASE_URL" -c "SELECT name, run_on FROM pgmigrations ORDER BY run_on;"
```

### Step 7 — Build and Deploy the Webapp

When running `scripts/aws/deploy.sh` this step is handled automatically — `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_SITE_URL` are written from `config/${STAGE}.env`.

For a manual webapp-only redeploy:

```bash
# Load the stage config to get APP_DOMAIN and API_DOMAIN
source config/dev.env   # or: config/prod.env

cd Source/webapp
cat > .env.production <<EOF
NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
EOF

npm run build   # Outputs static export to Source/webapp/out/

cd ../infra
npx cdk deploy WobblioWebStack-${STAGE} \
  --profile reuterAdmin --require-approval never
```

### Step 8 — Post-Deployment Checks

#### Confirm SNS email subscriptions

Two subscriptions require manual confirmation — check `antonioreuter@gmail.com`:
1. **Ops alarm topic** (`WobblioObservabilityStack`) — budget and cost anomaly alerts
2. **Shared DB alarm topic** (`shared-infra`) — RDS health alerts

#### Check ACM certificate status

DNS validation can take up to 30 minutes:

```bash
aws acm list-certificates --region us-east-1 --profile reuterAdmin \
  --query "CertificateSummaryList[?contains(DomainName,'wobblio')].{Domain:DomainName,Status:Status}" \
  --output table
# Expected Status: ISSUED
```

#### Smoke test endpoints

```bash
APP_DOMAIN="app.wobblio.com"    # or: app.dev.wobblio.com
API_DOMAIN="api.wobblio.com"    # or: api.dev.wobblio.com

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

#### Configure Cognito federation (manual, one-time)

After `WobblioAuthStack` deploys, configure Google and Meta (Facebook) federation in the Cognito console. Retrieve the User Pool ID from CDK outputs:

```bash
aws cloudformation describe-stacks \
  --stack-name WobblioAuthStack-${STAGE:-prod} \
  --profile reuterAdmin --region eu-west-1 \
  --query "Stacks[0].Outputs[*].{Key:OutputKey,Value:OutputValue}" \
  --output table
```

---

## 7. Re-deploy Checklist

Set `STAGE=dev` or `STAGE=prod` before running any of these.

| Changed area | Command |
|---|---|
| Backend Lambda code | `cd Source/infra && npx cdk deploy WobblioBackendStack-${STAGE} --profile reuterAdmin` |
| Webapp only | Build `Source/webapp` with correct domains → `cdk deploy WobblioWebStack-${STAGE}` |
| New DB migration | Set `DATABASE_URL` (§7.1), then `cd Source/infra && npm run migrate:up` |
| SSM parameter value | `aws ssm put-parameter --name <path> --value <val> --overwrite ...` (Lambda picks up on next cold start) |
| S3 bucket config | `cd Source/infra && npx cdk deploy WobblioStorageStack-${STAGE} --profile reuterAdmin` |
| Auth / Cognito | `cd Source/infra && npx cdk deploy WobblioAuthStack-${STAGE} --profile reuterAdmin` |
| Observability | `cd Source/infra && npx cdk deploy WobblioObservabilityStack-${STAGE} --profile reuterAdmin` |
| All stacks | `scripts/aws/deploy.sh --stage ${STAGE}` |

---

## 8. Database Operations

### 7.1 Retrieving `DATABASE_URL`

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
```

### 7.2 Migration Commands

```bash
cd Source/infra

npm run migrate:up               # Apply all pending migrations
npm run migrate:down             # Roll back the last migration
npm run migrate:create -- --name my-feature   # Scaffold a new migration file
```

Migration files live in `Source/infra/src/migrations/` and are TypeScript files using `node-pg-migrate`.

### 7.3 Applied Migrations

| Migration | Purpose |
|---|---|
| `20260611152000_initial-schema` | 32 tables, enums, indexes, seed data |
| `20260611170000_auth-rls-helpers` | Security-definer helper functions for RLS and waitlist management |

### 7.4 Schema Overview

**Tenant-scoped tables (RLS enabled — 14 tables):**

`app_user`, `household`, `household_member`, `invoice`, `invoice_line`, `invoice_feedback`, `shopping_list`, `shopping_list_item`, `budget`, `bill_split`, `bill_split_line`, `quota_counter`, `ingestion_ledger`, `data_request`

**Global tables (no RLS — 18 tables):**

`merchant`, `merchant_branch`, `merchant_alias`, `product`, `product_category`, `product_concept`, `product_alias`, `price_observation` *(anonymized, no tenant ref)*, `fx_rate`, `ai_spend_ledger`, `tenant_trust`, `tenant_signature`, `payment_transaction` *(7-year retention)*, `system_counter`, `limits`, `kpi_daily`

### 7.5 PostgreSQL Extensions

| Extension | Purpose | Requires |
|---|---|---|
| `uuid-ossp` | `uuid_generate_v4()` primary keys | Superuser install |
| `pg_trgm` | Fuzzy merchant/product alias matching | Superuser install |
| `vector` (pgvector) | 512-dim product embeddings, HNSW index | PostgreSQL ≥ 15.2, superuser |

Extensions must be installed by the `postgres` superuser (via `scripts/aws/bootstrap.sh`), not `wobblio_app`.

---

## 9. Configuration Reference

### 9.1 SSM Parameters (`/wobblio/config/`)

Parameters are seeded by `scripts/aws/bootstrap.sh`, which reads their values from `config/${STAGE}.env`. Lambdas read them at cold start. The table below shows the SSM path, the config-file variable that controls it, and the per-stage defaults.

| SSM path | Config variable | `dev` default | `prod` default |
|---|---|---|---|
| `/wobblio/config/models/vision_parser` | `MODEL_VISION_PARSER` | `amazon.nova-lite-v1:0` | `amazon.nova-lite-v1:0` |
| `/wobblio/config/models/auxiliary` | `MODEL_AUXILIARY` | `anthropic.claude-haiku-4-5-20251001-v1:0` | same |
| `/wobblio/config/models/insight` | `MODEL_INSIGHT` | `anthropic.claude-sonnet-4-6-v1:0` | same |
| `/wobblio/config/models/embedder` | `MODEL_EMBEDDER` | `amazon.titan-embed-text-v2:0` | same |
| `/wobblio/config/quotas/standard_uploads_per_week` | `QUOTA_STANDARD_UPLOADS_PER_WEEK` | `3` | `3` |
| `/wobblio/config/quotas/premium_uploads_per_week` | `QUOTA_PREMIUM_UPLOADS_PER_WEEK` | `10` | `10` |
| `/wobblio/config/quotas/household_uploads_per_week` | `QUOTA_HOUSEHOLD_UPLOADS_PER_WEEK` | `20` | `20` |
| `/wobblio/config/quotas/max_free_waitlist_cap` | `QUOTA_MAX_FREE_WAITLIST_CAP` | `100` | `5000` |
| `/wobblio/config/routing/max_stores` | `ROUTING_MAX_STORES` | `3` | `3` |
| `/wobblio/config/routing/min_split_saving_eur` | `ROUTING_MIN_SPLIT_SAVING_EUR` | `5.00` | `5.00` |
| `/wobblio/config/ai/daily_spend_cap` | `AI_DAILY_SPEND_CAP` | `0.05` | `0.10` |
| `/wobblio/config/tags/dedicated_call_enabled` | `TAGS_DEDICATED_CALL_ENABLED` | `false` | `false` |
| `/wobblio/config/tags/vocabulary` | `TAGS_VOCABULARY` | `[]` | `[]` |
| `/wobblio/config/ops/email` | `OPS_EMAIL` | `antonioreuter@gmail.com` | same |
| `/wobblio/config/web_app_url` | `WEB_APP_URL` | `https://app.dev.wobblio.com` | `https://app.wobblio.com` |
| `/wobblio/config/billing/mock_premium_whitelist` | `BILLING_MOCK_PREMIUM_WHITELIST` | `antonioreuter@gmail.com` | `-` |

**To change a value permanently:** edit `config/${STAGE}.env`, then re-run `scripts/aws/bootstrap.sh --force-ssm --stage ${STAGE}`.

**To make a one-off live change** (Lambda picks it up on next cold start):

```bash
aws ssm put-parameter \
  --name /wobblio/config/quotas/max_free_waitlist_cap \
  --value "3000" \
  --type String \
  --overwrite \
  --profile reuterAdmin --region eu-west-1
```

### 8.2 S3 Buckets

| Bucket name | Retention | Removal | Purpose |
|---|---|---|---|
| `wobblio-uploads-{stage}` | 18 months (GDPR) | prod: RETAIN | Raw receipt images |
| `wobblio-exports-{stage}` | 7 days | DESTROY | User data exports (temporary) |
| `wobblio-billing-archive-{stage}` | 90d → Glacier → 7 years | RETAIN | Stripe transaction archive |
| `wobblio-analytics-{stage}` | No lifecycle | RETAIN | Internal KPI/analytics data |

> **Warning:** `uploads`, `billing-archive`, and `analytics` buckets are `RETAIN` in production. Moving them to a new stack requires `cdk import` — do not delete and recreate.

### 8.3 SQS Queues

| Queue name | DLQ | Visibility timeout | Max receives | Purpose |
|---|---|---|---|---|
| `wobblio-ingestion-{stage}` | `wobblio-ingestion-dlq-{stage}` | 30 s | 3 | Receipt OCR pipeline |
| `wobblio-analytics-events-{stage}` | `wobblio-analytics-events-dlq-{stage}` | 30 s | 3 | Anonymous usage metrics |

### 8.4 Stripe Secret

Stored in Secrets Manager as `wobblio/{stage}/stripe`. Shape:

```json
{
  "secret_key": "sk_live_...",
  "webhook_secret": "whsec_..."
}
```

Update with real keys before transactional code runs:

```bash
aws secretsmanager update-secret \
  --secret-id wobblio/prod/stripe \
  --secret-string '{"secret_key":"sk_live_...","webhook_secret":"whsec_..."}' \
  --profile reuterAdmin --region eu-west-1
```

---

## 10. Lambda Fleet & API Reference

### 9.1 Lambda Functions

All Lambdas: Node.js 24, ARM64, 512 MB, 30 s timeout, CloudWatch logs 3-day retention.

| Handler | Reserved concurrency | Trigger | Auth | Description |
|---|---|---|---|---|
| `api-handler` | 25 | API Gateway | Cognito JWT | Catch-all authenticated route handler |
| `ingestion-worker` | 5 | SQS (ingestion queue) | — | Receipt OCR → merchant canon → product norm → invoice classify → price obs |
| `waitlist-status` | 5 | API Gateway `GET /waitlist/status` | None (public) | Returns `{"waitlistActive": bool}` |
| `analytics-events` | 5 | API Gateway `POST /analytics/events` | None (public) | Records anonymous usage events |
| `cron-budget-reset` | 2 | EventBridge Mon 00:00 UTC | — | Resets weekly upload quota counters |
| `cron-fx-rate-fetch` | 2 | EventBridge daily 06:05 UTC | — | Fetches currency exchange rates |
| `cron-waitlist-release` | 2 | EventBridge Mon 08:00 UTC | — | Releases FIFO batch from waitlist → ACTIVE, sends SES email |

> Cron rules are **disabled in `dev`** stage to prevent accidental runs.

**Pre/post Cognito trigger Lambdas** (deployed as part of `WobblioAuthStack`):
- `pre-signup-hook` — executes at user registration
- `post-confirmation-hook` — executes after email verification

### 9.2 API Gateway

| Property | Value |
|---|---|
| Base URL (prod) | `https://api.wobblio.com` |
| Base URL (dev) | `https://api.dev.wobblio.com` |
| Type | REST API |
| Authorizer | Cognito User Pool JWT |
| Throttling | 20 req/s sustained, 50 burst |
| CORS | All origins, all methods |
| Logging | ERROR level → CloudWatch, 3-day retention |
| Tracing | AWS X-Ray enabled |

**Route table:**

| Method | Path | Auth | Handler |
|---|---|---|---|
| GET | `/waitlist/status` | None (public) | `waitlist-status` |
| POST | `/analytics/events` | None (public) | `analytics-events` |
| ANY | `/{proxy+}` | Cognito JWT | `api-handler` |

### 9.3 Ingestion Pipeline (inside `ingestion-worker`)

```mermaid
flowchart TD
  SQS["SQS message received"] --> IDEM["Idempotency check\nINSERT ingestion_ledger\nON CONFLICT DO NOTHING"]
  IDEM --> DEDUP["SHA-256 dedup\n(same-tenant reject at presign-confirm)"]
  DEDUP --> VISION["Bedrock Vision parse\n(XML tags, schema-validated,\n1 retry → DLQ on 2nd fail)"]
  VISION --> MERCHANT["Merchant canonicalization\nalias hit → exact → pg_trgm → LLM fallback"]
  MERCHANT --> PRODUCT["Product normalization\nalias → batch LLM → pgvector match → write-back"]
  PRODUCT --> CLASSIFY["Invoice classification\nmerchant prior → line-item vote → LLM tiebreak"]
  CLASSIFY --> TAGS["Tag generation\ndeterministic first, LLM on expansion only"]
  TAGS --> WRITE["Tenant DB writes\ninvoice + invoice_line\n(inside ledger-keyed transaction)"]
  WRITE --> PRICE["Price observation emission\nanonymized, no tenant ref, day-precision, postal-prefix region"]
  PRICE --> NOTIFY["Push notification\nStatus: PARSED | NEEDS_REVIEW"]
```

---

## 11. Monitoring & Alerting

### 10.1 CloudWatch Logs

| Log group | Retention | Content |
|---|---|---|
| `/aws/lambda/wobblio-api-handler-{stage}` | 3 days | Structured JSON + X-Ray trace IDs |
| `/aws/lambda/wobblio-ingestion-worker-{stage}` | 3 days | Pipeline step results, errors |
| `/aws/lambda/wobblio-*-{stage}` | 3 days | Per-function structured logs |
| API Gateway execution logs | 3 days | ERROR-level, request/response metadata |

Query recent Lambda errors (replace function name as needed):

```bash
aws logs filter-log-events \
  --log-group-name /aws/lambda/wobblio-api-handler-prod \
  --filter-pattern "ERROR" \
  --start-time $(date -v-1H +%s000) \
  --profile reuterAdmin --region eu-west-1
```

### 10.2 Cost Monitoring

| Alert | Threshold | Channel |
|---|---|---|
| AWS Budgets — 50% | €15/month | Email `antonioreuter@gmail.com` |
| AWS Budgets — 80% | €24/month | Email |
| AWS Budgets — 100% | €30/month | Email |
| Cost Anomaly Detection | >€10/day | Email |

Confirm SNS subscription after first deployment (check inbox for confirmation email).

### 10.3 Lambda Cold-Start Test

```bash
FUNCTION_NAME=$(aws lambda list-functions --profile reuterAdmin --region eu-west-1 \
  --query "Functions[?contains(FunctionName,'waitlist-status')].FunctionName" \
  --output text)

aws lambda invoke \
  --function-name "$FUNCTION_NAME" \
  --payload '{}' \
  --profile reuterAdmin --region eu-west-1 \
  /tmp/lambda-response.json && cat /tmp/lambda-response.json
```

### 10.4 CloudFront Distribution Status

```bash
aws cloudfront list-distributions --profile reuterAdmin \
  --query "DistributionList.Items[?contains(Aliases.Items,'wobblio.com')].{Id:Id,Status:Status,Domain:DomainName}" \
  --output table
```

### 10.5 DLQ Monitoring

Check if messages are accumulating in dead-letter queues (indicates ingestion failures):

```bash
for QUEUE in wobblio-ingestion-dlq-prod wobblio-analytics-events-dlq-prod; do
  aws sqs get-queue-attributes \
    --queue-url "https://sqs.eu-west-1.amazonaws.com/$(aws sts get-caller-identity --profile reuterAdmin --query Account --output text)/${QUEUE}" \
    --attribute-names ApproximateNumberOfMessages \
    --profile reuterAdmin --region eu-west-1 \
    --query "Attributes.ApproximateNumberOfMessages" --output text
  echo " messages in ${QUEUE}"
done
```

---

## 12. Rollback Procedures

### 11.1 Database Migration Rollback

```bash
cd Source/infra && DATABASE_URL=$DATABASE_URL npm run migrate:down
# Rolls back the most recently applied migration
```

Verify:
```bash
psql "$DATABASE_URL" -c "SELECT name, run_on FROM pgmigrations ORDER BY run_on DESC LIMIT 5;"
```

### 11.2 Lambda / CDK Stack Rollback

Re-deploy from a previous git commit:

```bash
git checkout <previous-commit-sha>
cd Source/infra
npx cdk deploy WobblioBackendStack-${STAGE:-prod} \
  --profile reuterAdmin --require-approval never
```

CloudFormation also supports rollback via the console (Actions → Roll Back Stack) if the stack is in `UPDATE_ROLLBACK_FAILED` state.

### 11.3 Webapp Rollback

Re-run the webapp build from a previous commit and re-deploy:

```bash
git checkout <previous-commit-sha>
cd Source/webapp && npm run build
cd ../infra && npx cdk deploy WobblioWebStack-${STAGE:-prod} \
  --profile reuterAdmin --require-approval never
```

### 11.4 CloudFront Fallback URL

If the custom domain is broken, access the webapp directly via the CloudFront domain:

```bash
aws cloudfront list-distributions --profile reuterAdmin \
  --query "DistributionList.Items[?contains(Aliases.Items,'wobblio.com')].DomainName" \
  --output text
# Access: https://<xxxxxx>.cloudfront.net
```

---

## 13. Troubleshooting

| Symptom | Cause | Resolution |
|---|---|---|
| `HostedZone not found` during CDK synth | `wobblio.com` hosted zone missing | Create hosted zone: `aws route53 create-hosted-zone --name wobblio.com --caller-reference $(date +%s)` |
| ACM cert stuck in `PENDING_VALIDATION` | DNS CNAME not propagated | Wait up to 30 min; check Route53 console for CNAME records |
| `Parameter /shared/db/wobblio/secret-arn not found` | Wobblio not onboarded on shared RDS | Run `./scripts/onboard-app.sh wobblio wobblio_prod` from `shared-infra` |
| Lambda `ECONNREFUSED` or timeout to RDS | Wrong DB host or security group | Check `shared/db/wobblio` secret; confirm shared-infra SG allows port 5432 |
| CloudFront 403 on all pages | S3 OAC bucket policy stale | Re-deploy `WobblioWebStack-${STAGE}` (CDK regenerates bucket policy) |
| `migrate:up` fails: `role wobblio_app does not exist` | Onboarding not run | Re-run `onboard-app.sh wobblio wobblio_prod` |
| `CREATE EXTENSION "vector"` fails | PostgreSQL < 15.2 or wrong user | Verify version: `psql "$DATABASE_URL" -c "SHOW server_version;"` — must run as `postgres`, not `wobblio_app` |
| `.env.local` missing or stale | `make setup` not run, or `config/local.env` changed | Run `make setup` to regenerate `.env.local` from `config/local.env` |
| `AWS credentials not valid` | Profile not configured | Run `aws configure --profile reuterAdmin` |
| `cdk synth` fails with cdk-nag errors | IAC policy violation | Read the nag finding; add a suppression in the stack if intentional |
| DLQ messages accumulating | Ingestion failures (Bedrock schema, DB error) | Check ingestion-worker logs in CloudWatch; fix upstream data or schema, then redrive messages |
| Cognito federation not working | Google/Meta OAuth not configured | Complete manual federation setup in Cognito console (§6 Step 8) |

---

## 14. Security & Compliance Notes

### 13.1 Tenant Isolation (RLS)

Every API transaction must initialize the tenant context before querying tenant-scoped tables:

```sql
SET LOCAL app.current_tenant_id = '<cognito-sub-uuid>';
-- All subsequent queries within this transaction are tenant-filtered via RLS policies
```

Failure to set this context results in empty query results (RLS denies by default).

### 13.2 GDPR Invariants

| Rule | Detail |
|---|---|
| Account deletion | Two-phase: soft-lock → 30-day hard purge of all tenant data |
| Price observations | Survive account deletion — anonymized at creation, no tenant ref |
| Payment transactions | Kept 7 years; user ref replaced by opaque audit token at deletion |
| Presigned S3 URLs | Maximum TTL: **300 seconds** (enforced in StorageStack CORS + Lambda presign calls) |
| EXIF stripping | Must happen client-side before S3 PUT (mobile/web responsibility) |

### 13.3 Encryption Scope

KMS AES-GCM envelope encryption is applied **only** to:
- Free-text notes
- Household invite tokens
- Exported-report URLs
- Contact names used in bill splitting

**Not** encrypted (by design): amounts, merchants, products, categories, dates.

### 13.4 Role Management

The `role` column on `app_user` is **never writable by client APIs**. It is flipped only by:
- Stripe webhook handler (`STANDARD ↔ PREMIUM`)
- Operator scripts (`TESTER`, `ADMIN`)

### 13.5 Subscription Invariant

Subscriptions sell through **Stripe web checkout only**. Mobile app deep-links to the web checkout page. There is no in-app purchase path, ever.

### 13.6 Validation Gates (Required Before Any Deploy)

```bash
# Hexagonal architecture — must exit 0
cd Source/backend && npm run skill:hexagonal-architecture-validator

# Unit tests — all must pass
cd Source/backend && npm run test:unit

# GDPR/security audit — run when DDL or DB adapters change
cd Source/backend && npm run validate:security

# CDK nag — must pass before cdk deploy
cd Source/infra && STAGE=${STAGE:-dev} npm run cdk:synth
```
