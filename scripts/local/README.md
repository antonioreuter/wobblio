# Local Development

Local development runs **entirely on your machine** — no AWS credentials or cloud costs required.

| Service | Emulator | Address |
|---|---|---|
| S3 / SQS / SSM / Secrets Manager | LocalStack 3 | `http://localhost:4566` |
| PostgreSQL 15 + pgvector | Docker (`pgvector/pgvector:pg15`) | `localhost:5432` |
| Backend API | Local Node process | `http://localhost:3001` |
| Webapp | Next.js dev server | `http://localhost:3000` |

AWS SDK calls from the backend are transparently redirected to LocalStack via `AWS_ENDPOINT_URL=http://localhost:4566`. Bedrock calls are mocked at the port layer during unit tests; integration tests can extend the mock.

---

## Prerequisites

| Tool | Minimum version | Install |
|---|---|---|
| Node.js | 24 | https://nodejs.org or `nvm install 24` |
| Docker Desktop | latest | https://www.docker.com/products/docker-desktop/ |

No AWS account or credentials needed for local development.

---

## Quick Start (first time)

```bash
# 1. One-time setup: creates symlinks + copies .env.local.template → .env.local
make setup

# 2. .env.local comes pre-filled with local defaults — no edits needed

# 3. Start Docker services, deploy LocalStack bootstrap, migrate + seed
make deploy

# 4. Start the webapp
cd Source/webapp && npm run dev
# → http://localhost:3000
```

---

## What `make deploy` Does

`scripts/local-dev/deploy-local.sh` runs five steps automatically:

| Step | Action |
|---|---|
| 1 | `docker compose up -d --wait` — starts LocalStack + Postgres, waits for health checks |
| 2 | `npm install` in `Source/backend` and `Source/infra` (skipped if `node_modules` exists) |
| 3 | `cdklocal deploy WobblioLocalBootstrapStack-local` — creates S3 buckets, SQS queues, SSM params, and Secrets Manager stubs in LocalStack |
| 4 | `npm run migrate:up` — applies pending PostgreSQL migrations to local Postgres |
| 5 | `npm run seed:local` — seeds merchants, product taxonomy, and SSM parameters |

---

## Make Targets

| Target | Description |
|---|---|
| `make setup` | One-time: create symlinks (`backend/`, `infra/`) + copy `.env.local.template` |
| `make deploy` | Start Docker, deploy LocalStack bootstrap, migrate, seed |
| `make migrate` | Run pending DB migrations against local Postgres |
| `make validate` | Hexagonal architecture validator + GDPR security auditor |
| `make help` | List all available targets |

---

## Docker Services

```bash
# Start services
docker compose -f scripts/local-dev/docker-compose.yml up -d

# Check status
docker compose -f scripts/local-dev/docker-compose.yml ps

# Stop services (data persists in named volumes)
docker compose -f scripts/local-dev/docker-compose.yml stop

# Stop and wipe all data (full reset)
docker compose -f scripts/local-dev/docker-compose.yml down -v
```

---

## Local Endpoints & Resources

| Resource | Address | Notes |
|---|---|---|
| Webapp | `http://localhost:3000` | Next.js dev server |
| Backend API | `http://localhost:3001` | Local Lambda runner |
| LocalStack | `http://localhost:4566` | All AWS service calls |
| Postgres | `localhost:5432` | DB `wobblio_local`, user `wobblio_dev` |
| S3 uploads | `wobblio-uploads-local` | Via LocalStack |
| SQS ingestion | `wobblio-ingestion-local` | Via LocalStack |
| Cognito | Not emulated | Unit tests mock the Cognito port |
| Bedrock | Not emulated | Unit tests mock the Bedrock port |

---

## Running Tests

```bash
# Unit tests — mocked ports, zero network calls, fastest
cd Source/backend && npm run test:unit

# Architecture validator
cd Source/backend && npm run skill:hexagonal-architecture-validator

# GDPR/security audit (run when DDL or DB adapters change)
cd Source/backend && npm run validate:security

# CDK synth (local stage, cdk-nag gate)
cd Source/infra && STAGE=local npm run cdk:synth
```

---

## Reset Local Environment

```bash
# Wipe Docker volumes (Postgres data + LocalStack state)
docker compose -f scripts/local-dev/docker-compose.yml down -v

# Re-run full setup
make deploy
```

---

## Troubleshooting

**`Docker is not running`**
→ Start Docker Desktop, then retry `make deploy`.

**`LocalStack health check failed`**
→ `docker compose -f scripts/local-dev/docker-compose.yml logs localstack`
→ Ensure port 4566 is not in use: `lsof -i :4566`

**`pg_isready` health check times out**
→ `docker compose -f scripts/local-dev/docker-compose.yml logs postgres`
→ Ensure port 5432 is not in use: `lsof -i :5432`

**`cdklocal: command not found`**
→ `npm install` inside `Source/infra` — `aws-cdk-local` is a dev dependency.

**`migrate:up` fails with connection error**
→ Confirm Postgres container is running: `docker compose -f scripts/local-dev/docker-compose.yml ps postgres`
→ Test connectivity: `psql "$DATABASE_URL" -c "SELECT 1"`

**Tables missing after `make deploy`**
→ Check migration output for errors. Re-run: `make migrate`

**SSM parameters not found by backend**
→ `WobblioLocalBootstrapStack` deploy may have failed. Check LocalStack logs and re-run `make deploy`.
