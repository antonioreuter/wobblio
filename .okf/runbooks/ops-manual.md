---
type: Operations Guide
title: Operations Manual & Administrative Runbook
description: Guidelines for local development sandbox setup, deployment workflows, admin console capabilities, and observability monitoring.
tags: [operations, runbooks, localstack, monitoring, admin-console]
timestamp: 2026-06-23T22:23:00Z
---

# Operations Manual & Administrative Runbook

This operations guide defines the procedures for local development, administrative tasks, deployment pipelines, and observability monitoring for Wobblio.

---

## 1. Local Development Sandbox

Local development operates entirely on-device, emulating AWS compute and storage services without incurring AWS costs.

### Tech Stack Emulators
* **LocalStack 3:** Emulates S3, SQS, SSM, and Secrets Manager on `http://localhost:4566`.
* **PostgreSQL 15 + pgvector:** Runs in Docker (`pgvector/pgvector:pg15`) on `localhost:5432`.
* **Webapp:** Next.js development server runs on `http://localhost:3000`.
* **Backend API:** Express/Local Node server runs on `http://localhost:3001`.

### Local Sandbox Lifecycle Commands
```bash
make setup      # Creates symlinks and copies config/local.env -> .env.local
make bootstrap  # Initializes Docker containers, applies migrations, seeds parameters & catalogs
make deploy     # Light rebuild: boots Docker, deploys bootstrap CDK to LocalStack, runs migrations
```

### Database Migrations (node-pg-migrate)
Database migrations live in `Source/infra/src/migrations/`.
* **Apply Migrations:** `npm run migrate:up` (runs within `Source/infra`).
* **Rollback Migration:** `npm run migrate:down` (reverts the last migration).
* **Create Migration:** `npm run migrate:create -- --name my-migration-name`.

---

## 2. Admin Console Capabilities

The Admin Console provides central control over waitlists, queues, and catalog curation.

### 2.1 Catalog Curation Queue
Auto-created products and merchants reside in `PROVISIONAL` status and must be moderated before global publication:
* **The Listing Criteria:** The curation screen fetches provisional lists via the database functions `admin_provisional_merchants()` and `admin_provisional_products()`. 
* **Prioritization:** The queue is sorted by `tenant_count DESC` (number of tenants waiting on the item) followed by `observation_count DESC` (corroborating scans).
* **Actions:**
  * **Approve:** Sets status to `ACTIVE`. Any quarantined observations in `price_observation` are immediately un-quarantined and enter the comparison index.
  * **Reject:** Sets status to `INACTIVE` (permanently hiding it).
  * **Merge:** Merges a provisional duplicate into a canonical seed. Retargets the associated `merchant_alias` / `product_alias` and `price_observation` rows to the target canonical ID, then marks the source entity `INACTIVE`.

### 2.2 Waitlist Release Mechanism
Waitlist limits are governed by the SSM parameter `max_free_users_cap`:
* A pre-signup Cognito hook compares active standard users against this cap.
* When the administrator increases the cap, the waitlist cron/operator job releases users in FIFO order:
  * Atomic counter claims: Slots are claimed atomically using `tryClaimSlot(cap)` to prevent race conditions.
  * Release command triggers: Promoted users are flipped from `STATUS_WAITLIST` to `ACTIVE` in Cognito/DB, and welcome emails are sent via Amazon SES.

### 2.3 DLQ Panel & Replay
The Dead Letter Queue (DLQ) panel in the Admin Console allows operators to inspect and replay messages that failed processing (e.g. vision parser failures or JSON validation retries).

---

## 3. Application Observability & Monitoring

Wobblio relies on a low-cost, log-derived telemetry model rather than continuous custom metric publishing.

### 3.1 Log-Derived Telemetry
Per-stage telemetry is outputted as plain structured logs in CloudWatch:
* **Inference Tracking:** `event: bedrock_usage` logs model role, prompt version, input/output tokens, and cost.
* **Ingestion Metrics:** `ingestion timing` logs `status`, `totalMs`, `workerMs`, and `queueWaitMs`.
* **Abuse Control:** `event: quota_block` logs tenant blocks.
* **Daily Aggregation Cron:** A nightly EventBridge cron Lambda (`cron-ingestion-metrics-rollup`) runs Logs Insights queries to aggregate the prior day's logs and writes the results into `kpi_daily`.

### 3.2 Alarm Inventory
All alerts route to the SNS ops topic (`wobblio-ops-{env}`). Key alarms include:

| Area | Metric/Condition | Threshold |
|---|---|---|
| Ingestion | DLQ queue depth | $>0$ messages for 5 mins |
| Ingestion | `FAILED_PROCESSING` rate | $>5\%$ of daily ingestions |
| Quality | Feedback `DOWN` ratio | $>20\%$ daily (min 10 votes) |
| Quality | Schema-validation retry rate | $>10\%$ daily |
| RDS | CPU credit balance (t3 credit metric) | $<50$ credits |
| RDS | Connection count | $>60$ of $\approx 85$ max |
| Cost | AWS Budgets | $50\% / 80\% / 100\%$ of €100/mo cap |
