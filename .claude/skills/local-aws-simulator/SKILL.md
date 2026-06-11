---
name: local-aws-simulator
description: Manages local emulators (LocalStack, Postgres, Cognito-local, Bedrock mock) for rapid backend validation without AWS connection costs.
---

# Local AWS Simulator

Starts and stops the Wobblio local development stack. All configuration lives in `docker-compose.yml` at the repository root.

## Services

| Service | Image | Port | Purpose |
|---|---|---|---|
| `wobblio-postgres` | `pgvector/pgvector:pg16-alpine` | 5432 | PostgreSQL with pgvector + pg_trgm |
| `wobblio-localstack` | `localstack/localstack:3.8.0` | 4566 | AWS emulation (S3, SQS, Lambda, API Gateway, SNS, SES, SSM, Secrets Manager, EventBridge, KMS) |
| `wobblio-cognito` | `jagregory/cognito-local` | 9229 | Cognito auth substitute |
| `wobblio-bedrock-mock` | built from `tools/bedrock-mock/` | 4577 | Bedrock Converse API mock (vision, auxiliary, embedder) |

## Usage

```bash
# Start all services
make start

# Stop all services
make stop

# Check service status
docker compose ps

# Tail logs (all services, or a specific one)
make logs
make logs service=localstack

# Full reset (destroys all volumes, restarts, re-deploys)
make reset
```

## Bootstrap & Seed

After services start, run the full local bootstrap once:

```bash
./deploy-local.sh
```

This: bootstraps CDK against LocalStack, deploys `WobblioLocalBootstrapStack` (S3, SQS, SSM, Secrets Manager), runs migrations, and seeds merchant aliases + product taxonomy.

## LocalStack Desktop

Install the native desktop app to browse LocalStack resources visually:

- Download: https://docs.localstack.cloud/user-guide/tools/localstack-desktop/
- Connect to: `http://localhost:4566`

## First-time setup

```bash
# Install developer tooling (symlink fix for hexagonal validator)
make setup

# Copy env template
cp .env.local.template .env.local
```

## Configuration

All environment variables are documented in `.env.local.template` at the repository root.
