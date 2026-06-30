---
type: Infrastructure Reference
title: Cloud Infrastructure & Deployment
description: AWS architecture mapping, CDK stack divisions, lambda concurrency envelope, and CI/CD pipelines.
tags: [infrastructure, deployment, aws, cdk, cicd]
timestamp: 2026-06-30T22:53:00Z
---

# Cloud Infrastructure & Deployment

Wobblio is designed as a cloud-native, serverless architecture deployed on AWS. Infrastructure is provisioned via the AWS Cloud Development Kit (CDK) in TypeScript and strictly enforces boundary security and cost containment.

---

## 1. AWS Component Architecture

```
                             ┌───────────────┐
                             │ Next.js Web   │ (OpenNext SSR)
                             └───────┬───────┘
                                     │
                                     ▼
                       ┌───────────────────────────┐
                       │    AWS API Gateway (v2)   │
                       └─────────────┬─────────────┘
                                     │
                                     ▼
  ┌───────────────┐    ┌───────────────────────────┐    ┌───────────────┐
  │  AWS Cognito  │◄───┤    Lambda API Handlers    ├───►│  Stripe API   │
  │  User Pool    │    │ (api-handler concurrency) │    │  (Monetize)   │
  └───────────────┘    └─────────────┬─────────────┘    └───────────────┘
                                     ├────────────────────────┐
                                     ▼                        ▼
  ┌───────────────┐    ┌───────────────────────────┐    ┌───────────────┐
  │  AWS S3       │◄───┤    RDS PostgreSQL 15      │◄───┤  AWS KMS CMK  │
  │  Receipts     │    │  (RLS tenant isolation)   │    │  (Encryption) │
  └───────┬───────┘    └─────────────▲─────────────┘    └───────────────┘
          │ S3 Upload                │ Write
          ▼                          │
  ┌───────────────┐    ┌─────────────┴─────────────┐
  │  AWS SQS      │───►│ Ingestion Worker Lambda   │───► AWS Bedrock Converse
  │ Ingestion Q   │    │  (concurrency limited)    │    (Vision OCR / Models)
  └───────────────┘    └───────────────────────────┘
```

* **Next.js Web Frontend:** Managed via OpenNext and deployed as serverless edge functions.
* **AWS Cognito:** Handles OIDC identity federation (Google/Meta) and credentials. Pre-signup hooks handle capacity limits and waitlisting.
* **AWS API Gateway:** Proxies user traffic using a Cognito JWT authorizer, applying WAF-lite filtering and request rate throttling.
* **Lambda Fleet:** Modular API handlers execute business logic. Communication is strictly directed inward through hexagonal ports.
* **AWS SQS:** Decouples the image ingestion workers. Uploads are placed directly onto the SQS queue via API confirmation. If a processing error occurs 3 times, the message is routed to the Dead Letter Queue (DLQ).
* **AWS Bedrock Converse API:** Connects to model endpoints (`Qwen` for vision parsing, `Haiku` for auxiliary resolution, `Titan V2` for product embeddings).
* **RDS PostgreSQL:** Shared relational database running PostgreSQL 15 on a single instance (`db.t3.micro`). Uses `pgvector` for similarity queries and `pg_trgm` for trigram string matching.
* **AWS KMS:** Manages customer-controlled keys (CMK) for envelope AES-GCM encryption of personal data fields.

---

## 2. CDK Stack Separation

To prevent application updates from impacting critical persistence stores, the infrastructure is split into two independent CDK packages:
1. **Stateful Stack (`WobblioStatefulStack`):** Provisions persistent resources. This includes the VPC, RDS database instance, S3 upload/export buckets, Cognito User Pools, and KMS key rings. It is rarely updated, and has deletion protection enabled.
2. **Application Stack (`WobblioAppStack`):** Provisions stateless components. This includes the Lambda functions, SQS queues, EventBridge schedules, API Gateway configurations, CloudWatch alarms, and SNS topics. It is deployed frequently through CI/CD pipelines.

---

## 3. Concurrency Limits & Connection Budgeting

Because the database operates on a resource-constrained `db.t3.micro` instance, it supports a maximum connection ceiling of **90 connections**. Runaway concurrent Lambda containers would easily overwhelm the pool.

The system enforces strict concurrency envelopes:
* **API Fleet Handlers (`api-handlers`):** Capped at a maximum reserved concurrency of **25**.
* **Ingestion Worker Lambda:** SQS trigger concurrency is limited to **5** (`maxConcurrency`).
* **Cron Lambdas:** Scheduled EventBridge tasks are capped at a maximum of **2** concurrent invocations.
* **Database Pooling:** One pool client is initialized per Lambda container, reusing connection objects across invocations. Statement execution timeouts are set at `5s` for interactive API paths, and `30s` for background worker tasks.

### Concurrency Escalation Ladder
* **Step 1:** If p95 api concurrency sustains $>20$ for a week, provision an **RDS Proxy** (approx. €11/month) to handle connection pooling before raising any caps.
* **Step 2:** If CPU credits are exhausted, upgrade the RDS instance to a `db.t4g.small` (Graviton-based, approx. €26/month).

---

## 4. Environment Architecture

* **`local`:** Runs on LocalStack (emulating S3/SQS) and dockerized PostgreSQL (`docker-compose.yml`) for rapid desktop unit testing.
* **`dev`:** Suffixes resource names with `-dev` on AWS, leveraging logical database schemas on the shared RDS database node. Uses sandbox Stripe credentials.
* **`prod`:** The live application stack. Connects to the primary DB schema. Production Stripe webhooks trigger role updates, and CloudWatch alarms route alerts to the operations team.

---

## 5. CI/CD Pipeline Strategy

```
  [Developer Branch] ──► Create PR ──► [Gated PR Pipeline] (Validates codebase)
                                                 │
                                                 ▼ Merge to Main
                                       [Dev Deploy Pipeline] (Auto deploys to Dev)
                                                 │
                                                 ▼
                                        [Human Approval Gate]
                                                 │
                                                 ▼ Approved
                                       [Prod Deploy Pipeline] (Promotes to Prod)
```

### 5.1 Gated PR Pipeline (Pre-Merge)
Runs on every Pull Request targetting the `main` branch. All steps must succeed (exit code `0`) before a merge is permitted:
1. **Linter & Typecheck:** `npm run lint` and `npm run typecheck`.
2. **Hexagonal Boundaries Audit:** `npm run skill:hexagonal-architecture-validator` verifies that core domain services never import infrastructure or SDK dependencies.
3. **GDPR & Security Audit:** `npm run validate:security` scans SQL queries and S3 configs for RLS compliance and GDPR metadata leaks.
4. **Unit Tests:** Executes Vitest suite with mocked ports (`npm run test:unit`) targeting 100% core domain coverage.

### 5.2 Deploy & Promotion Pipeline
1. **Dev Deployment:** Triggered automatically upon merge to `main`. Builds resources and deploys the Application Stack to the `dev` environment.
2. **Integration Testing:** Runs tests against LocalStack and dev PostgreSQL schemas.
3. **Approval Gate:** The pipeline halts and requests explicit engineering/product sign-off.
4. **Prod Deployment:** Upon approval, CDK deploys the application code changes to the production AWS account, updating Lambda code in place without database downtime.
