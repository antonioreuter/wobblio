---
type: Reference Manual
title: API Endpoints, Core Components, & Observability
description: Comprehensive specifications for API routing paths, Hexagonal modular families, and CloudWatch metrics/alarms telemetry.
tags: [openapi, architecture, components, observability, monitoring]
timestamp: 2026-06-24T09:05:00Z
---

# API Endpoints, Core Components, & Observability

This manual provides the technical specifications for Wobblio's API endpoints, the responsibilities of each Hexagonal module, and the observability design.

---

## 1. API Endpoints Catalog

Wobblio exposes public routes, protected user routes (requiring Cognito JWT in `Authorization`), and restricted administrative routes (requiring the `ADMIN` role).

### 1.1 Public Routes (No Auth Required)
* **`GET /waitlist/status`**
  * *Purpose:* Checks if the free-user cap has been reached. Used by the landing page to dynamically render either the "Sign Up" or "Join Waitlist" call to action.
  * *Cache:* Publicly cached via API Gateway headers (`s-maxage=300, stale-while-revalidate=60`).
* **`POST /analytics/events`**
  * *Purpose:* Receives anonymous marketing funnel events (e.g. `hero_cta_click`, `pricing_view`) and enqueues them into SQS for nightly rollup.

### 1.2 User Profile & Account Paths (`/me/*`)
* **`GET /me/profile`** / **`PUT /me/profile`**
  * *Purpose:* Fetches or updates user profile metadata (country, region, language, home currency, and GDPR consents).
  * *Gating:* Accessible to waitlisted users to allow onboarding completion.
* **`GET /me/usage`**
  * *Purpose:* Returns quota consumption (scans used, cap, remaining, or unlimited).
* **`GET /me/advisor`**
  * *Purpose:* Returns the active weekly advisor card text (null if none generated for the current week).
* **`GET /me/stats/top-merchant`**
  * *Purpose:* Fetches the merchant brand where the user spent the most money during the current calendar month.

### 1.3 Invoices & Capture Paths (`/invoices/*`)
* **`GET /invoices`**
  * *Purpose:* Lists the trailing 100 invoices uploaded by the tenant.
* **`GET /invoices/{invoiceId}`**
  * *Purpose:* Fetches detailed invoice data, including itemized lines, and returns a 5-minute S3 presigned image GET URL.
* **`DELETE /invoices/{invoiceId}`**
  * *Purpose:* Deletes the invoice and raw S3 file. Fails with `409` if the ingestion worker is still processing the file.
* **`POST /invoices/presign`**
  * *Purpose:* Pre-registers the scan and returns a presigned S3 PUT URL. Verifies weekly uploads quota and SHA-256 duplicate image hashes.
* **`POST /invoices/{invoiceId}/confirm`**
  * *Purpose:* Enqueues the processing job in the SQS queue to kick off the ingestion pipeline.
* **`PUT /invoices/{invoiceId}/location`**
  * *Purpose:* Confirms the purchase location. If mapped to active regions, it releases observations to the de-identified price store.
* **`POST /invoices/{invoiceId}/share`**
  * *Purpose:* Generates an unguessable 7-day magic URL (`/r/{token}`) to view the receipt.
* **`POST /invoices/{invoiceId}/feedback`**
  * *Purpose:* Submits a parse feedback rating (`verdict: 'UP' | 'DOWN'`).

### 1.4 Budgets Paths (`/budgets/*`)
* **`GET /budgets`** / **`POST /budgets`**
  * *Purpose:* Lists active budgets or creates a new budget (scoped to `TOTAL`, `CATEGORY`, or `MEMBER`). Evaluates and fires budget threshold alerts immediately upon creation/modification.
* **`PATCH /budgets/{id}`** / **`DELETE /budgets/{id}`**
  * *Purpose:* Updates the amount/period of a budget or deletes a budget.

### 1.5 Shopping Lists & Optimization Paths (`/lists/*`)
* **`GET /lists`** / **`POST /lists`**
  * *Purpose:* Lists active shopping lists or creates a new one.
* **`GET /lists/{id}`** / **`DELETE /lists/{id}`**
  * *Purpose:* Fetches list details or deletes the list.
* **`POST /lists/{id}/items`** / **`PUT /lists/{id}/items/{itemId}`**
  * *Purpose:* Adds items to the shopping list, or marks them checked/unchecked.
* **`POST /lists/{id}/optimize`**
  * *Purpose:* Runs the split-route shopping optimizer on the shopping list, outputting expected costs and store assignments.

### 1.6 Catalog & Price Indexes Paths
* **`GET /products`**
  * *Purpose:* Typeahead search (auto-complete) against the active product catalog.
* **`GET /price-trends/comparison`**
  * *Purpose:* Returns price trends for selected products. Emits both personal averages and regional market averages (market average restricted to premium accounts).
* **`GET /reference/categories`** / **`GET /reference/regions`**
  * *Purpose:* Returns the static categories taxonomy and country subdivisions.

### 1.7 Administration Paths (`/admin/*` — ADMIN Role Required)
* **`GET /admin/kpis`**
  * *Purpose:* Queries rolled-up business metrics from `kpi_daily` for dashboards.
* **`GET /admin/curation/provisional`**
  * *Purpose:* Returns lists of provisional products and merchants pending curation.
* **`POST /admin/curation/approve`** / **`POST /admin/curation/reject`** / **`POST /admin/curation/merge`**
  * *Purpose:* Manually curates catalogs (activates, deactivates, or merges duplicates).
* **`GET /admin/dlq`** / **`POST /admin/dlq/replay`**
  * *Purpose:* Lists and replays SQS Dead Letter Queue messages.

---

## 2. Core Application Components

Under Hexagonal architecture, Wobblio is modularized into **12 core families** that implement the business logic and port bindings:

```text
Source/backend/src/core/services/
├── identity/          # Manages user accounts, Cognito federations, and onboarding.
├── ingestion/         # Drives the S3 upload lifecycle, presign, confirmation, and SQS queue routing.
├── data-intelligence/ # Normalizes receipts: resolves merchants (trigram/LLM), expands products (LLM),
│                      # matches vector embeddings (pgvector), and writes to the price store.
├── budgets/           # Manages budgets and triggers push notifications at 85% / 100% caps.
├── households/        # Manages shared household pools, invites, and pooled quotas.
├── lists/             # Manages active shopping lists.
├── notifications/     # Dispatches email alerts (via SES) and push notification cards.
├── optimizer/         # Computes greedy split-route lists partitioning.
├── quota/             # Checks and increments standard and household weekly scan quotas.
├── waitlist/          # Enforces the waitlist gate and drives FIFO cohort releases.
├── observability/     # Generates daily rollups and KPI rollups from Log Insights.
└── billing/           # Connects to Stripe Checkout and handles webhooks.
```

---

## 3. Observability & Monitoring

Wobblio implements a decoupled, low-cost observability system designed for serverless environments.

### 3.1 Live Built-in AWS Metrics
The Operations Dashboard (`wobblio-{stage}-ops`) monitors active service state using AWS native namespaces:
* **Lambda:** Invocation counts, error rates, concurrent executions, and throttles.
* **API Gateway:** 5xx error rate, invocation count, and p99 integration latency.
* **RDS PostgreSQL:** DB connections, CPU utilization, and **CPU credit balance** (crucial for detecting t3 burst exhaustion).
* **SQS:** Ingestion SQS queue age of the oldest message and DLQ message count.

### 3.2 Log-Derived Metrics & Rolling Rollups
To avoid expensive custom CloudWatch metrics (e.g. EMF), Wobblio writes JSON-structured metadata logs. A nightly EventBridge cron Lambda (`cron-ingestion-metrics-rollup` at `02:00 UTC`) runs Logs Insights queries on these logs, saving the results to `kpi_daily`:
* **Telemetry logs:**
  * Ingestion Timing: `ingestion timing` logs `status`, `totalMs`, `workerMs`, and `queueWaitMs`.
  * AI Tokens & Costs: `event: bedrock_usage` logs model role, prompt version, input/output tokens, and cost.
  * Quota Blocks: `event: quota_block` logs whenever a user hits their weekly upload ceiling.

### 3.3 Active Alerts Inventory
All alarms route to the SNS topic `wobblio-ops-{stage}`, sending notifications to operator emails:
* **DLQ Alarm:** Triggers immediately if any message enters the DLQ for more than 5 minutes.
* **Down-Ratio Alarm:** Triggers if users submit $>20\%$ `DOWN` verdicts on parsed receipts daily (with a minimum of 10 votes, filtering out noise).
* **DB Connection Alarm:** Triggers if database connections exceed `60` (of $\approx 85$).
* **RDS Credit Alarm:** Triggers if CPU credit balance falls below `50` credits.
* **Cost Alarms:** Evaluated via AWS Budgets and Cost Anomaly Detection (alerts on deviations $> \text{€}10/\text{day}$).
