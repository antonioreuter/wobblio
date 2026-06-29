# 02 — Agentic Pipeline CDK Stack (`WobblioAgenticPipelineStack`)

**Non-Functional 01 · Phase 3/5 · Standalone agentic compute & queue**

Parent: [../01-data-ai-pipeline.md](../01-data-ai-pipeline.md) §2 · Index: [README](./README.md)

## Overview

A separate CDK stack isolating the agentic pipeline's compute and queue from
`WobblioBackendStack`, preventing dependency bloat. Defines the agentic SQS queue + DLQ and the
worker Lambda (skeleton here; agent logic lands in [03](./03-strands-agent-worker.md)).
Deployable independently — until routing ([04](./04-dynamic-queue-routing.md)) flips the flag,
the queue simply receives no traffic.

## Dependencies

- None functionally, but reads cross-stack resources via SSM (DB endpoint/secret, uploads
  bucket name, KMS key ARN) the way `WobblioBackendStack` already does.
- Reference patterns: `Source/infra/src/cdk/stacks/WobblioBackendStack.ts`,
  `Source/infra/bin/wobblio.ts`, `cdk/config/environment.ts`.

## Design

### 1. Stack class & wiring

New `WobblioAgenticPipelineStack` in `Source/infra/src/cdk/stacks/`, instantiated in
`bin/wobblio.ts` after backend/storage/db (for cross-stack lookups). Stage-aware resource
names via `resourceName()`.

### 2. Resources (parent §2)

- **`WobblioAgenticQueue`** — visibility timeout 300s (matches Lambda), KMS-encrypted with the
  shared `dbStack.kmsKey`, `enforceSSL`, DLQ redrive `maxReceiveCount: 3`.
- **`WobblioAgenticDLQ`** — KMS-encrypted, 14-day retention, **CloudWatch alarm** when
  `ApproximateNumberOfMessagesVisible > 0` for 5 minutes.
- **`WobblioAgenticWorkerLambda`** — Node.js 24, ARM64, private subnets with RDS SG ingress,
  timeout 300s, `commonLambdaEnv` (STAGE, DB_HOST/PORT/SECRET_ARN, KMS_KEY_ARN) + uploads
  bucket name + model/feature SSM paths. Event source on `WobblioAgenticQueue` with
  `batchSize: 1`, `maxConcurrency: 5`, `reportBatchItemFailures: true`.

### 3. IAM least-privilege (parent §2)

Reuse the backend stack's grant helpers — no wildcards:

- RDS SG ingress; Secrets Manager read on the DB secret; KMS decrypt.
- S3 `s3:GetObject` on the shared uploads bucket.
- `grantBedrockInference` (InvokeModel / InvokeModelWithResponseStream on
  `foundation-model/*` + `inference-profile/*`, with IAM5 suppression for runtime model IDs).
- SSM `GetParameter`/`GetParameters` scoped to
  `/wobblio/config/{models,tags,features}/*`.

### 4. Cross-stack export

Export `WobblioAgenticQueue` URL via SSM parameter (e.g. `/wobblio/config/queues/agentic_url`)
or CfnOutput so the routing adapter ([04](./04-dynamic-queue-routing.md)) consumes it without a
hard CDK dependency from the backend stack.

## Checklist

- [ ] `WobblioAgenticPipelineStack` class + `bin/wobblio.ts` wiring (stage-aware names)
- [ ] Queue (300s, KMS) + DLQ (`maxReceiveCount:3`) + DLQ>0 alarm
- [ ] Worker Lambda (Node 24, private subnets, RDS SG, `maxConcurrency:5`, `reportBatchItemFailures`)
- [ ] IAM: RDS/Secrets/KMS, S3 GetObject, Bedrock invoke, scoped SSM — no wildcards
- [ ] Agentic queue URL exported for routing
- [ ] `cdk synth` + `cdk-nag` pass
