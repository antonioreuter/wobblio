# Wobblio — Local Development Deployment

Quick, step-by-step guide for setting up and running Wobblio locally. For detailed troubleshooting and architecture background, see `docs/runbook.md` §5.

---

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | ≥ 24 |
| Docker Desktop | latest |
| npm | ≥ 10 |

No AWS credentials needed for local development.

---

## First-Time Setup

One-time setup to get the full local stack running (Docker + LocalStack + Postgres + migrations + seed data).

```bash
# From repo root

# 1. Create symlinks and copy .env.local from config/local.env
make setup

# 2. Full bootstrap: Docker + extensions + LocalStack CDK + migrations + seed
make bootstrap

# 3. Start the webapp dev server
cd Source/webapp && npm run dev
```

After this, you have:
- **LocalStack** (S3, SQS, SSM, Secrets Manager) on `http://localhost:4566`
- **PostgreSQL 15** on `localhost:5432`
- **Cognito Local** (mock auth) on `http://localhost:9229`
- **Webapp dev server** on `http://localhost:3000`
- **Backend API** on `http://localhost:3001`

> **Note:** The first bootstrap takes ~3 minutes. Subsequent starts only need the daily restart steps below.

### What `make bootstrap` Does

| Phase | Action | Time |
|---|---|---|
| 1 | `docker compose up -d --wait` — starts LocalStack + Postgres + Cognito Local | ~30s |
| 2 | Installs `uuid-ossp`, `pg_trgm`, `vector` extensions | ~20s |
| 3 | `npm install` in `Source/backend` and `Source/infra` | ~60s |
| 4 | `cdklocal deploy WobblioLocalBootstrapStack-local` — creates S3, SQS, SSM, Secrets, Cognito User Pool | ~40s |
| 5 | `npm run migrate:up` — applies migrations | ~5s |
| 6 | `npm run seed:local` — seeds merchants, products, SSM params | ~10s |

---

## Daily Restart

After the initial setup, restart with:

```bash
# Start Docker services (if not already running)
docker compose -f scripts/local/docker-compose.yml up -d

# Start the webapp
cd Source/webapp && npm run dev
```

Or use the faster Makefile target:

```bash
make deploy
cd Source/webapp && npm run dev
```

---

## Development Workflow

### Running Tests Locally

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

Or use the Makefile:

```bash
make validate
```

### Running Migrations Locally

```bash
cd Source/infra
npm run migrate:up       # Apply all pending migrations
npm run migrate:down     # Roll back the last migration
npm run migrate:create -- --name my-feature   # Scaffold a new migration
```

### Accessing the Local Database

```bash
# Connect with psql (password is "wobblio_dev_secret")
psql -h localhost -U wobblio_dev -d wobblio_local

# Or use DATABASE_URL from .env.local
psql "$DATABASE_URL"
```

### Seeding Reference Data

```bash
cd Source/infra
npm run seed:local
```

---

## Docker Services

### Status & Logs

```bash
# Check health of all services
docker compose -f scripts/local/docker-compose.yml ps

# View logs
docker compose -f scripts/local/docker-compose.yml logs -f
docker compose -f scripts/local/docker-compose.yml logs -f postgres
docker compose -f scripts/local/docker-compose.yml logs -f localstack
```

### Stop Services (Data Persists)

```bash
docker compose -f scripts/local/docker-compose.yml stop
```

### Start Services Again

```bash
docker compose -f scripts/local/docker-compose.yml up -d
```

### Full Reset (Wipe Data)

```bash
docker compose -f scripts/local/docker-compose.yml down -v
make deploy
```

---

## Makefile Targets

| Target | Description |
|---|---|
| `make setup` | One-time: create symlinks + sync `.env.local` from `config/local.env` |
| `make bootstrap` | One-time: full bootstrap (Docker + extensions + LocalStack + migrations + seed) |
| `make deploy` | Restart: Docker up, redeploy LocalStack CDK, run pending migrations |
| `make migrate` | Run pending migrations |
| `make validate` | Hexagonal architecture validator + GDPR security auditor |
| `make help` | List all targets |

---

## `.env.local` Reference

`make setup` (and `make bootstrap`) copies `config/local.env` → `.env.local`. All values are pre-filled; no manual editing is needed. Key variables:

| Variable | Value | Notes |
|---|---|---|
| `STAGE` | `local` | Activates LocalStack endpoints |
| `AWS_ENDPOINT_URL` | `http://localhost:4566` | Redirects AWS SDK calls to LocalStack |
| `DATABASE_URL` | `postgres://wobblio_dev:wobblio_dev_secret@localhost:5432/wobblio_local` | Local Postgres, no SSL |
| `S3_UPLOADS_BUCKET` | `wobblio-uploads-local` | LocalStack S3 |
| `SQS_INGESTION_QUEUE_URL` | `http://localhost:4566/000000000000/wobblio-ingestion-local` | LocalStack SQS |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:3001` | Local API |

To override a value locally (e.g., test a real Stripe key), append to `.env.local` after generation — it is gitignored.

---

## Troubleshooting

| Symptom | Cause | Resolution |
|---|---|---|
| `Docker is not running` | Docker Desktop stopped | Start Docker Desktop, retry `make deploy` |
| LocalStack health check fails | Port 4566 already in use or service misconfigured | `docker compose logs localstack` — check if port 4566 is free |
| Postgres health check fails | Port 5432 already in use or service misconfigured | `docker compose logs postgres` — verify port 5432 is free |
| `cdklocal: command not found` | CDK local tool not installed | Run `npm install` inside `Source/infra` |
| `migrate:up` connection error | Postgres container not healthy | `docker compose ps postgres` — confirm status is `healthy` |
| SSM parameters not found | LocalStack state is stale or CDK didn't run | Re-run `make deploy` (Step 3 re-deploys `WobblioLocalBootstrapStack`) |
| `.env.local` missing or stale | `make setup` not run | Run `make setup` to regenerate from `config/local.env` |
| `npm install` fails in a workspace | Dependencies stale or lock file mismatch | `rm -rf node_modules package-lock.json && npm install` |

---

## Services & Ports

| Service | Address | Purpose |
|---|---|---|
| LocalStack | `http://localhost:4566` | AWS service emulator (S3, SQS, SSM, Secrets Manager) |
| PostgreSQL 15 | `localhost:5432` | Database |
| Cognito Local | `http://localhost:9229` | Mock Cognito User Pool + OAuth |
| Webapp (Next.js) | `http://localhost:3000` | Frontend |
| Backend API | `http://localhost:3001` | REST API |

All services run in Docker except the webapp and backend (which run in your terminal via `npm run dev`).

---

## Quick Commands Cheat Sheet

```bash
# Setup & Bootstrap
make setup              # One-time: symlinks + .env.local
make bootstrap          # One-time: full local environment
make deploy             # Daily: restart services + re-sync

# Development
cd Source/webapp && npm run dev    # Start webapp (auto-reload)
cd Source/backend && npm run dev   # Start backend API

# Testing & Validation
make validate           # Hexagonal + GDPR + cdk synth checks
cd Source/backend && npm run test:unit
cd Source/backend && npm run test:coverage

# Database
cd Source/infra && npm run migrate:up
cd Source/infra && npm run migrate:down
cd Source/infra && npm run seed:local
psql "$DATABASE_URL"    # Connect to local DB

# Docker
docker compose -f scripts/local/docker-compose.yml ps
docker compose -f scripts/local/docker-compose.yml logs -f
docker compose -f scripts/local/docker-compose.yml down -v  # Full reset
```

---

## Next Steps

1. Complete [First-Time Setup](#first-time-setup)
2. Read `docs/runbook.md` §5 for architecture details
3. Check `CLAUDE.md` for project rules and invariants
