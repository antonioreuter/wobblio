# Database Setup Guide

Wobblio uses a **shared PostgreSQL 15 instance** managed by the `shared-infra` CDK project.
This guide covers the one-time operator steps required before running Wobblio migrations,
plus the day-to-day migration commands for local and cloud environments.

## Architecture Overview

| Resource | Managed by | How Wobblio reads it |
|---|---|---|
| RDS PostgreSQL 15 (`shared-rds-pg15`) | `shared-infra` CDK | SSM `/shared/db/endpoint` |
| Default VPC + subnets | `shared-infra` CDK | SSM `/shared/vpc-id` |
| Per-app DB role + database | `onboard-app.sh` (below) | SSM `/shared/db/wobblio/secret-arn` |
| KMS CMK (field encryption) | Wobblio CDK (`WobblioDbStack`) | Lambda env `KMS_KEY_ARN` |

**Lambda connectivity (interim MVP):**
Lambda functions run **outside the VPC** and connect to the RDS public endpoint.
The DB security group permits this (`0.0.0.0/0:5432`). All connections use `sslmode=require`.
This is an accepted cost/complexity trade-off; the target posture is in-VPC Lambda + SG-based ingress.

---

## Prerequisites

- AWS CLI configured for `eu-west-1` with appropriate IAM permissions
- `psql` client installed (or access to a bastion/shell with `psql`)
- `shared-infra` project cloned at a known path and deployed (`cdk deploy`)
- `jq` installed for credential extraction scripts

---

## Step 1 — Onboard Wobblio in shared-infra (one-time per environment)

Run this from the `shared-infra` project root as an operator:

```bash
cd /path/to/shared-infra
./scripts/onboard-app.sh wobblio wobblio_prod
```

This script creates:
- PostgreSQL role `wobblio_app` with a random 32-character password
- Database `wobblio_prod` owned by `wobblio_app`
- Secrets Manager secret `shared/db/wobblio` with connection details:
  ```json
  {
    "username": "wobblio_app",
    "password": "<generated>",
    "host":     "<rds-endpoint>",
    "port":     "5432",
    "dbname":   "wobblio_prod"
  }
  ```
- SSM parameter `/shared/db/wobblio/secret-arn` pointing to the secret ARN

**Do not skip this step.** The `migrate:up` and all Lambda functions read credentials
from `shared/db/wobblio`. If the secret does not exist, they will fail at runtime.

---

## Step 2 — Install PostgreSQL Extensions (one-time, using master credentials)

The `wobblio_app` role lacks `rds_superuser` and cannot install extensions.
Run the automated environment bootstrap script to fetch credentials, install extensions (`uuid-ossp`, `pg_trgm`, `vector`), seed parameters, and initialize Secrets:

```bash
# Run for the default prod stage
./scripts/bootstrap-aws.sh

# Or run for a specific stage (e.g. dev)
./scripts/bootstrap-aws.sh --stage dev
```

**Required extensions:**

| Extension | Purpose |
|---|---|
| `uuid-ossp` | `uuid_generate_v4()` default for all primary keys |
| `pg_trgm` | Trigram fuzzy matching on `merchant_alias` and `product_alias` |
| `vector` (pgvector) | 512-dim product embeddings, HNSW cosine index |

pgvector is available on RDS PostgreSQL ≥ 15.2. Verify with:
```bash
psql "$DATABASE_URL" -c "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';"
```

---

## Step 3 — Set DATABASE_URL for Migrations

`node-pg-migrate` reads the `DATABASE_URL` environment variable.

```bash
# Retrieve Wobblio app credentials
SECRET_ARN=$(aws ssm get-parameter \
  --name /shared/db/wobblio/secret-arn \
  --query Parameter.Value --output text)

SECRET_JSON=$(aws secretsmanager get-secret-value \
  --secret-id "$SECRET_ARN" \
  --query SecretString --output text)

export DATABASE_URL="postgres://$(echo $SECRET_JSON | jq -r .username):$(echo $SECRET_JSON | jq -r .password)@$(echo $SECRET_JSON | jq -r .host):$(echo $SECRET_JSON | jq -r .port)/$(echo $SECRET_JSON | jq -r .dbname)?sslmode=require"
```

---

## Step 4 — Run Migrations

```bash
cd Source/infra

# Apply all pending migrations
npm run migrate:up

# Roll back the most recent migration
npm run migrate:down

# Check migration ledger
psql "$DATABASE_URL" -c "SELECT id, name, run_on FROM pgmigrations ORDER BY run_on;"
```

Expected on first run:
```
 id |              name                   |          run_on
----+-------------------------------------+----------------------------
  1 | 20260611152000_initial-schema       | 2026-xx-xx xx:xx:xx.xxx
```

---

## Local Development

The Docker Compose stack runs PostgreSQL 16 with pgvector pre-installed — no manual
extension setup needed.

```bash
# Start local services
cd scripts/local-dev && docker-compose up -d

# Run migrations against local DB
cd Source/infra
DATABASE_URL=postgres://wobblio_dev:wobblio_dev_secret@localhost:5432/wobblio_local \
  npm run migrate:up

# Seed reference data (merchants, products, SSM parameters in LocalStack)
npm run seed:local
```

Verify the schema is correct:
```bash
psql "postgres://wobblio_dev:wobblio_dev_secret@localhost:5432/wobblio_local" \
  -c "\dt" -c "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
```

---

## Connection Details Reference

| Environment | Host | Database | Credentials |
|---|---|---|---|
| `local` | `localhost:5432` | `wobblio_local` | Hard-coded in `docker-compose.yml` |
| `dev` | SSM `/shared/db/endpoint` | `wobblio_prod` | Secrets Manager `shared/db/wobblio` |
| `prod` | SSM `/shared/db/endpoint` | `wobblio_prod` | Secrets Manager `shared/db/wobblio` |

> **Note:** `dev` and `prod` currently share the same `wobblio_prod` database on the shared RDS.
> To add a separate dev database, run `./scripts/onboard-app.sh wobblio-dev wobblio_dev`
> in shared-infra, then create a second set of SSM parameters.

---

## Schema Summary

- **14 tenant-scoped tables** — RLS enabled; every query requires `SET LOCAL app.current_tenant_id = '<uuid>'`
- **18 global tables** — no RLS; includes merchants, products, price observations, kpi_daily
- **Migration tool:** `node-pg-migrate` (ledger in `pgmigrations` table)
- **DDL:** `Source/infra/src/migrations/20260611152000_initial_schema.ts`

RLS pattern enforced in every API Lambda:
```sql
SET LOCAL app.current_tenant_id = '<cognito-sub-uuid>';
-- all subsequent queries within the transaction are automatically tenant-filtered
```

---

## Troubleshooting

**`CREATE EXTENSION` fails with "permission denied"**
→ Run Step 2 using master `postgres` credentials, not `wobblio_app`.

**`migrate:up` fails with "connection refused" or "ECONNREFUSED"**
→ Check `DATABASE_URL` is exported and includes `sslmode=require` for cloud environments.
→ For local: ensure `docker-compose up -d` is running (`docker ps` to verify postgres container).

**`vector` extension not found after install**
→ Confirm RDS engine version ≥ 15.2. Check: `psql "$DB_URL" -c "SHOW server_version;"`.

**Migration applied but tables missing**
→ Confirm `DATABASE_URL` points to `wobblio_prod` (not `postgres` master DB).

**`pgmigrations` table already exists, migration not applied**
→ `node-pg-migrate` tracks migrations by name. If the file was renamed, drop and re-add the row manually, or create a new migration for the diff.

**KMS encrypt/decrypt fails in Lambda**
→ Confirm the Lambda execution role has `kms:GenerateDataKey` and `kms:Decrypt` on the Wobblio CMK.
→ Check `KMS_KEY_ARN` env var is set (injected by `WobblioAppStack`).
