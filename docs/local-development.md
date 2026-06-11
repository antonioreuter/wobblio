# Local Development

This guide explains how to run the full Wobblio stack on your machine using Docker and LocalStack.

---

## Prerequisites

| Tool | Minimum version | Install |
|---|---|---|
| Docker Desktop | 4.x | https://www.docker.com/products/docker-desktop |
| Node.js | 24 | https://nodejs.org or `nvm install 24` |
| AWS CLI v2 | 2.x | https://aws.amazon.com/cli/ |
| LocalStack Desktop | latest | https://docs.localstack.cloud/user-guide/tools/localstack-desktop/ |

> **LocalStack Desktop** is a native macOS/Windows/Linux app that provides a visual resource browser for your local S3 buckets, SQS queues, SSM parameters, Secrets Manager, and more. Install it once — no account required for Community Edition.

---

## Quick Start

```bash
# 1. Copy the env template
cp .env.local.template .env.local

# 2. (One-time) developer setup — creates the backend symlink for validators
make setup

# 3. Start all local services
make start

# 4. Bootstrap CDK, deploy local stack, run migrations, seed data
make deploy
```

That's it. The Makefile will print all endpoint URLs when it finishes.

> The deploy script lives at `scripts/local-dev/deploy-local.sh` — always invoke it via `make deploy` from the repo root so paths resolve correctly.

---

## Service Endpoints

| Service | URL | Notes |
|---|---|---|
| PostgreSQL | `localhost:5432` | db `wobblio_local`, user `wobblio_dev` |
| LocalStack | `http://localhost:4566` | All AWS services behind a single endpoint |
| Cognito local | `http://localhost:9229` | JWT auth substitute |
| Bedrock mock | `http://localhost:4577` | Vision, auxiliary, and embedder responses |

**LocalStack Desktop:** open the app and connect to `http://localhost:4566` to browse resources visually.

---

## Make Targets

| Target | Description |
|---|---|
| `make start` | Start all Docker services and print endpoint table |
| `make stop` | Stop all services (data is preserved) |
| `make reset` | **Destroys all data**, restarts services, re-runs `deploy-local.sh` |
| `make deploy` | Run `deploy-local.sh` (CDK bootstrap + seed) |
| `make seed` | Re-run seed scripts only (services must already be running) |
| `make migrate` | Run pending database migrations |
| `make logs` | Tail all service logs |
| `make logs service=localstack` | Tail a single service |
| `make validate` | Run hexagonal architecture validator + GDPR security auditor |
| `make setup` | One-time: create `backend` symlink, remind you to copy `.env.local` |
| `make help` | Show all targets |

---

## Environment Variables

All variables are documented in `.env.local.template`. Key ones:

| Variable | Default | Purpose |
|---|---|---|
| `STAGE` | `local` | Controls CDK stack selection and resource naming |
| `AWS_ENDPOINT_URL` | `http://localhost:4566` | Routes AWS SDK calls to LocalStack |
| `DATABASE_URL` | (built from DB_* vars) | PostgreSQL connection string |
| `BEDROCK_ENDPOINT` | `http://localhost:4577` | Points to the Bedrock mock |
| `BEDROCK_ERROR_INJECTION_RATE` | `0` | Float 0–1: inject Bedrock errors for DLQ testing |
| `LOCALSTACK_AUTH_TOKEN` | _(blank)_ | Fill in for LocalStack Pro features |

---

## What Gets Seeded

After `./deploy-local.sh` runs:

**SSM parameters** (`/wobblio/config/…`):
- Model IDs: `mock-vision-model`, `mock-auxiliary-model`, `mock-embedder-model`, `mock-insight-model`
- Quota caps: standard (3/week), premium (10/week), household (20/week)
- Routing thresholds, feature flags
- Tag vocabulary: ~70 tags with Dutch and English labels and trigger maps

**PostgreSQL** (once migrations have run — Spec 02):
- 11 NL launch-market merchant aliases (Albert Heijn, Jumbo, Lidl, Aldi, Plus, Dirk, Kruidvat, Etos, Trekpleister, HEMA, Action)
- 14 top-level product categories + 10 Groceries sub-categories

**LocalStack resources** (via CDK `WobblioLocalBootstrapStack`):
- S3 buckets: `wobblio-uploads-local`, `wobblio-exports-local`, `wobblio-billing-archive-local`, `wobblio-analytics-local`
- SQS queues: `wobblio-ingestion-local` (with DLQ)
- SSM parameter stubs, Secrets Manager secrets

---

## Running Tests

```bash
# Backend unit tests (mocked ports, fast)
cd Source/backend && npm run test:unit

# Hexagonal architecture validator (must exit 0 before commit)
make validate

# Or run both directly:
cd Source/backend
npm run skill:hexagonal-architecture-validator
npm run validate:security
```

---

## Reset & Clean Slate

```bash
make reset
```

This will:
1. Ask for confirmation (this is destructive)
2. Run `docker compose down -v` — removes all Docker volumes (wipes Postgres data, LocalStack state, Cognito users)
3. Start services fresh
4. Re-run `deploy-local.sh`

---

## LocalStack Desktop Walkthrough

1. Download and install from https://docs.localstack.cloud/user-guide/tools/localstack-desktop/
2. Open the app
3. Click **Add Instance** → enter `http://localhost:4566`
4. Click **Connect**
5. You can now browse S3 buckets, SQS queues, SSM parameters, Secrets Manager secrets, and more from a GUI

---

## Troubleshooting

**LocalStack container is not healthy**

The most common cause is the Docker socket mount. Make sure Docker Desktop is running and the socket exists:
```bash
ls /var/run/docker.sock
```
LocalStack needs this socket to spawn Lambda containers.

**`pg_trgm` or `vector` extension not found**

These extensions are activated automatically by `tools/db-init/init.sql` when the Postgres container first starts. If you see this error, the init script may not have run. Try:
```bash
make reset
```

**`cdklocal: command not found`**

Install it via the backend project:
```bash
cd Source/backend && npm install
```
Then retry `./deploy-local.sh`. The script also falls back to `npx cdklocal` automatically.

**CDK synth fails with cdk-nag errors**

The `WobblioLocalBootstrapStack` has `NagSuppressions` for all rules that don't apply to LocalStack. If you see a new unhandled nag rule, add a suppression in `Source/backend/src/cdk/stacks/WobblioLocalBootstrapStack.ts` with the reason `'Local development only'`.

**Bedrock mock returns unexpected responses**

The mock routes by model ID pattern (`vision`, `embedder`, everything else → auxiliary). Set `BEDROCK_ERROR_INJECTION_RATE=0.5` in `.env.local` to simulate 50% Bedrock errors and test your DLQ paths.

**Seed step warns "Table does not exist — skipping"**

This is expected before Spec 02 (database schema) is implemented. The SSM seed still runs. PostgreSQL table seeds will apply automatically once you run migrations in Spec 02.
