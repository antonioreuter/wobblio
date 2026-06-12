# Local Development

Local development runs **entirely on your machine** — no AWS credentials or cloud costs required.

| Service | Emulator | Address |
|---|---|---|
| S3 / SQS / SSM / Secrets Manager | LocalStack 3 | `http://localhost:4566` |
| PostgreSQL 15 + pgvector | Docker (`pgvector/pgvector:pg15`) | `localhost:5432` |
| Cognito User Pool + auth | cognito-local (`jagregory/cognito-local`) | `http://localhost:9229` |
| Backend API | Local Node process | `http://localhost:3001` |
| Webapp | Next.js dev server | `http://localhost:3000` |

AWS SDK calls from the backend are transparently redirected to LocalStack via `AWS_ENDPOINT_URL=http://localhost:4566`. Bedrock calls are mocked at the port layer during unit tests; integration tests can extend the mock.

---

## Prerequisites

| Tool | Minimum version | Install |
|---|---|---|
| Node.js | 24 | https://nodejs.org or `nvm install 24` |
| Docker Desktop | latest | https://www.docker.com/products/docker-desktop/ |
| AWS CLI | v2 | https://aws.amazon.com/cli/ (used by `make cognito-init`) |

No AWS account or credentials needed for local development.

---

## Quick Start (first time)

```bash
# 1. One-time setup: create symlinks + copy .env.local from config/local.env
make setup

# 2. Full bootstrap: Docker + LocalStack + DB + cognito-local init + seed
make bootstrap

# 3. Start the webapp
cd Source/webapp && npm run dev
# → http://localhost:3000

# Sign in with the seed user:
#   Email:    dev@wobblio.local
#   Password: Dev1234!@#$
```

---

## What `make bootstrap` Does

| Phase | Action |
|---|---|
| 1 | `docker compose up -d --wait` — starts LocalStack, Postgres, and cognito-local |
| 1b | `init-cognito.sh` — creates user pool + client in cognito-local, seeds test user |
| 2 | Installs `uuid-ossp`, `pg_trgm`, `vector` extensions in Postgres |
| 3 | `npm install` in `Source/backend` and `Source/infra` |
| 4 | `cdklocal deploy WobblioLocalBootstrapStack-local` — creates S3, SQS, SSM, Secrets Manager in LocalStack |
| 5 | `npm run migrate:up` — applies pending PostgreSQL migrations |
| 6 | `npm run seed:local` — seeds merchants, product taxonomy, SSM parameters |

---

## Make Targets

| Target | Description |
|---|---|
| `make setup` | One-time: create symlinks (`backend/`, `infra/`) + sync `.env.local` |
| `make bootstrap` | One-time: full bootstrap (Docker + LocalStack + DB + cognito + seed) |
| `make restart` | Start/restart Docker services (LocalStack, Postgres, cognito-local) |
| `make cognito-init` | (Re-)initialize cognito-local: user pool, client, and test user |
| `make deploy` | Start Docker, redeploy LocalStack CDK stack, run pending migrations |
| `make migrate` | Run pending DB migrations against local Postgres |
| `make validate` | Hexagonal architecture validator + GDPR security auditor |
| `make help` | List all available targets |

---

## Docker Services

```bash
# Start / restart all services
docker compose -f scripts/local/docker-compose.yml up -d

# Check status
docker compose -f scripts/local/docker-compose.yml ps

# Stop services (data persists in named volumes)
docker compose -f scripts/local/docker-compose.yml stop

# Stop and wipe all data (full reset)
docker compose -f scripts/local/docker-compose.yml down -v
```

---

## Local Endpoints & Resources

| Resource | Address | Notes |
|---|---|---|
| Webapp | `http://localhost:3000` | Next.js dev server |
| Backend API | `http://localhost:3001` | Local Lambda runner |
| LocalStack | `http://localhost:4566` | All AWS service calls |
| cognito-local | `http://localhost:9229` | Cognito User Pool API (not hosted UI) |
| Postgres | `localhost:5432` | DB `wobblio_local`, user `wobblio_dev` |
| S3 uploads | `wobblio-uploads-local` | Via LocalStack |
| SQS ingestion | `wobblio-ingestion-local` | Via LocalStack |
| Bedrock | Not emulated | Unit tests mock the Bedrock port |

> **cognito-local note:** The local Cognito emulator supports the Cognito API (`InitiateAuth`, `SignUp`, etc.) but does **not** implement the Cognito Hosted UI OAuth flow. Local login uses a credentials form (email/password) instead of the production OIDC redirect.

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

# Webapp unit tests
cd Source/webapp && npm run test:unit
```

---

## Reset Local Environment

```bash
# Wipe Docker volumes (Postgres data + LocalStack state + cognito-local data)
docker compose -f scripts/local/docker-compose.yml down -v

# Re-run full bootstrap
make bootstrap
```

---

## Troubleshooting

**`Docker is not running`**
→ Start Docker Desktop, then retry `make restart`.

**`LocalStack health check failed`**
→ `docker compose -f scripts/local/docker-compose.yml logs localstack`
→ Ensure port 4566 is not in use: `lsof -i :4566`

**`pg_isready` health check times out**
→ `docker compose -f scripts/local/docker-compose.yml logs postgres`
→ Ensure port 5432 is not in use: `lsof -i :5432`

**`cognito-local not reachable at http://localhost:9229`**
→ Run `make restart` first, then retry `make cognito-init`.
→ Ensure port 9229 is not in use: `lsof -i :9229`

**Login fails locally (`Invalid email or password`)**
→ Re-run `make cognito-init` to recreate the user pool and seed user.
→ Test user is `dev@wobblio.local` / `Dev1234!@#$`.

**`cdklocal: command not found`**
→ `npm install` inside `Source/infra` — `aws-cdk-local` is a dev dependency.

**`migrate:up` fails with connection error**
→ Confirm Postgres container is running: `docker compose -f scripts/local/docker-compose.yml ps postgres`
→ Test connectivity: `psql "$DATABASE_URL" -c "SELECT 1"`

**Tables missing after `make bootstrap`**
→ Check migration output for errors. Re-run: `make migrate`

**SSM parameters not found by backend**
→ `WobblioLocalBootstrapStack` deploy may have failed. Check LocalStack logs and re-run `make deploy`.
