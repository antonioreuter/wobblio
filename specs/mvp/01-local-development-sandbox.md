# 01 — Local Development Sandbox

**Epic 2 | Phase 1 | Blocks all local development**

## Overview

A fully self-contained local development environment using LocalStack (AWS emulation) and a Dockerized PostgreSQL instance. Developers can run the full stack locally without AWS credentials or real infrastructure costs.

## Dependencies

- [00 — Design System & Wireframes](./00-design-system-wireframes.md) (loose — can start in parallel)

## Scope

- `docker-compose.yml` with LocalStack + PostgreSQL
- `deploy-local.sh` deployment script
- Local CDK synthesis targeting LocalStack endpoints
- Seeded test data for merchant aliases and product taxonomy
- Environment variable management for the `local` target

## Environment Strategy

Three environments, all sharing the same RDS node:
- `local` — LocalStack + dockerized PostgreSQL
- `dev` — logical DB/schema on shared RDS, `-dev` resource suffix
- `prod` — logical DB/schema on shared RDS, `-prod` resource suffix

Stripe webhook secret and price IDs live in Secrets Manager per environment.

## Services Emulated by LocalStack

- S3 (receipt image uploads, exports bucket, billing archive)
- SQS (ingestion queue + DLQ)
- Lambda
- API Gateway
- SNS (push notifications)
- SES (email)
- SSM Parameter Store (model IDs, caps, thresholds)
- Secrets Manager (DB secret, Stripe secrets)
- Bedrock (mock stubs for vision/auxiliary/embedder calls)
- EventBridge (cron triggers)
- KMS (encryption key for field-level encryption)

---

## Checklist

### Docker Compose Setup
- [ ] PostgreSQL service with health check and persistent volume
- [ ] LocalStack service with the required service list (`S3,SQS,LAMBDA,API_GW,SNS,SES,SSM,SECRETSMANAGER,EVENTS,KMS`)
- [ ] Network definition so Lambda containers can reach PostgreSQL
- [ ] `.env.local` template with all required variables

### Deployment Script (`deploy-local.sh`)
- [ ] Bootstrap CDK against LocalStack endpoint
- [ ] Synthesize and deploy all stacks targeting LocalStack
- [ ] Run database migrations against the local PostgreSQL instance
- [ ] Seed SSM parameters: model IDs, quota caps, routing thresholds, tag vocabulary
- [ ] Seed merchant aliases for NL launch chains (Albert Heijn, Jumbo, Lidl, Aldi, Plus, Dirk, Kruidvat, Etos, Trekpleister, HEMA, Action)
- [ ] Seed product taxonomy (two-level, ~14 top-level categories)
- [ ] Seed tag vocabulary (~60–80 tags with trigger maps) into SSM

### CDK Local Configuration
- [ ] Environment detection — `local` target routes all AWS SDK calls to LocalStack endpoints
- [ ] cdk-nag bypasses that are safe for local (not for dev/prod)
- [ ] Separate `cdk.context.json` entries for `local` vs `dev`/`prod`

### Bedrock Mock
- [ ] Vision parse mock returning a valid JSON schema response
- [ ] Auxiliary model mock returning merchant/product/tag expansion stubs
- [ ] Embedder mock returning a deterministic 512-dim vector
- [ ] Configurable error injection for testing DLQ paths

### Developer Experience
- [ ] `README` with one-command startup: `docker-compose up && ./deploy-local.sh`
- [ ] `make` targets (or equivalent) for: start, stop, reset, seed, logs
- [ ] Hot-reload for Lambda functions in local mode
- [ ] Local Cognito substitute (or Cognito local) for auth testing
