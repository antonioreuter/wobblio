---
type: Infrastructure Reference
title: Target Environments (Local, Dev, Prod)
description: Tech stack configuration, authentication, billing integration, database access, and deployment differences across development stages.
tags: [infrastructure, environment, localstack, dev, prod, stripe, cognito]
timestamp: 2026-06-30T22:57:00Z
---

# Target Environments (Local, Dev, Prod)

Wobblio operates across three distinct execution environments: **Local**, **Development (dev)**, and **Production (prod)**. This document specifies the configuration, database isolation, billing credentials, authentication, and deployment rules for each environment.

---

## 1. Environment Comparison Matrix

| Attribute | Local (`local`) | Development (`dev`) | Production (`prod`) |
|---|---|---|---|
| **Hosting Model** | Developer local machine | AWS Serverless Stack (`-dev` suffix) | AWS Serverless Stack (`-prod` suffix) |
| **Database** | Docker PostgreSQL 15 + pgvector | Shared RDS `db.t3.micro` (`wobblio_dev` schema) | Shared RDS `db.t3.micro` (`wobblio_prod` schema) |
| **AWS Emulator** | LocalStack 3 (S3, SQS, SSM) | None (Real AWS Services) | None (Real AWS Services) |
| **Cognito User Pool** | Local mock or Cognito-local | AWS Cognito Dev User Pool | AWS Cognito Prod User Pool |
| **Stripe Billing** | Stripe CLI webhook forwarding | Stripe Test Mode | Stripe Live Mode |
| **Bedrock API** | Local Ollama (Gemma fallback) | Real Bedrock (Lower-cost models) | Real Bedrock (Production-grade models) |
| **SSL/DNS** | `localhost` | `dev.wobblio.com` (ACM certificate) | `wobblio.com` (ACM certificate) |
| **Observability** | Console stdout / local logs | Dev CloudWatch (Basic logs) | Production CloudWatch + SNS Alarms |

---

## 2. Environment Details

### 2.1 Local Sandbox Environment (`local`)
Designed to allow full desktop development without internet access or running up cloud-provider costs.

* **Tech Stack Containers:**
  - **Database:** Runs in a Docker container (`pgvector/pgvector:pg15`) on `localhost:5432`.
  - **AWS Emulator:** LocalStack 3 emulates S3 buckets, SQS queues, SSM, and Secrets Manager on `http://localhost:4566`.
  - **Auth:** Cognito-local container emulates Cognito JWT signatures, allowing local client tokens.
* **Billing Setup:**
  - Stripe CLI listens in webhook forwarding mode:
    ```bash
    stripe listen --forward-to localhost:3001/api/billing/webhook
    ```
  - Loaded with Stripe test price IDs and mock webhook secrets.
* **AI Model Fallback:**
  - Bedrock API calls are routed to a local Ollama service (`http://localhost:11434`) running the lightweight `gemma:2b` or `qwen2:7b` models, serving as free OCR and canonicalization mock fallbacks.
* **Configuration:** Environment variables are loaded from `.env.local` (populated from `.env.local.template` during `make setup`).

---

### 2.2 Development Environment (`dev`)
The logical preview staging area deployed to AWS. It is used to test CDK stack changes, run integration test cycles, and preview features.

* **CDK Suffixing:**
  - App resources are suffix-tagged as `WobblioAppStack-dev` and `WobblioStatefulStack-dev`.
* **Database Isolation:**
  - Shares the `db.t3.micro` PostgreSQL database node with the production environment to minimize monthly baseline costs.
  - Segmented strictly using a dedicated PostgreSQL logical schema named `wobblio_dev` with dev-specific RLS policies.
* **Auth & Federation:**
  - Deploys a dedicated Cognito Dev User Pool.
  - Linked to developer-restricted Google/Meta API credentials for test federation logins.
* **Stripe Test Integration:**
  - Operations use Stripe **Test Mode**. Stripe API test credentials and webhook keys are securely fetched from AWS Secrets Manager.
  - Test-tier prices are loaded into the database quota mapping.
* **Routing & SSL:**
  - DNS resolved to `dev.wobblio.com`. AWS Route53 points to the CloudFront distribution, and AWS ACM manages the SSL/HTTPS certificate.

---

### 2.3 Production Environment (`prod`)
The high-security, live environment serving actual customers.

* **CDK Suffixing:**
  - Resources are grouped under `WobblioAppStack-prod` and `WobblioStatefulStack-prod`.
* **Database Security:**
  - Uses the `wobblio_prod` schema on RDS PostgreSQL.
  - RDS storage-level encryption is enabled.
  - Security Groups are locked down: only Lambdas in the application security group can connect to the database.
* **Stripe Live Integration:**
  - Configured with Stripe **Live Mode** keys.
  - Emits real payment charges, utilizes live Stripe tax modules, and directs users to the real Stripe Customer Portal. Webhook verification checks signatures strictly.
* **OIDC Identity Federation:**
  - Production Cognito User Pool using verified Google and Meta production client secrets.
* **Bedrock & SSM Pointers:**
  - Routes prompts to Bedrock production endpoints.
  - SSM parameter matrices (`/wobblio/config/models/vision_parser`, `/wobblio/config/models/embedder`) track production model IDs, allowing live, zero-downtime model upgrades.
* **Observability & Budgets:**
  - Full operations dashboard (`wobblio-prod-ops`).
  - Active AWS Budgets alarms configured at €100/month limit.
  - Active SNS topic (`wobblio-ops-prod`) alerts operator emails on SQS DLQ, CPU credit exhaustion, or p95 latency breaches.
* **Routing & SSL:**
  - DNS resolves to the primary apex domain `wobblio.com` and `www.wobblio.com`.

---

## 3. Configuration Management

Environment settings must never be hard-coded.
- Secret tokens (DB passwords, Stripe secret keys, client secrets) live in **AWS Secrets Manager** under `{stage}/wobblio/secrets`.
- Non-secret system parameters (model IDs, quota limits, waitlist caps) live in **AWS SSM Parameter Store** under `/wobblio/{stage}/config/`.
- Handlers fetch settings at runtime using the `IConfigProvider` port, ensuring code packages remain identical and portable across environments.
