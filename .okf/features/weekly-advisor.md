---
type: Feature Specification
title: Weekly AI Savings Advisor
description: Execution model, model tier mappings, database schema, and storage constraints of the advisor.
tags: [features, weekly-advisor, cron, bedrock]
timestamp: 2026-06-23T21:56:00Z
---

# Weekly AI Savings Advisor

The Weekly AI Savings Advisor runs as an EventBridge cron job that generates custom savings recommendations for premium users based on their spending and regional price anomalies.

## 1. Eligible Tenant Selection

To optimize costs and avoid executing prompts on inactive accounts, the advisor cron selects candidates using a dedicated DB function (`list_advisor_eligible_tenants`):
* Must be a `PREMIUM` subscriber with an `ACTIVE` status.
* Must have uploaded at least one invoice that successfully parsed (`PARSED` or `NEEDS_REVIEW`) during the current calendar week.

## 2. Model Assignment & Mappings

* **SSM Indirection:** The model identifier is loaded from SSM (`/wobblio/config/models/auxiliary`). It is hot-swappable and can be changed without code changes.
* **Tier Adjustment:** While older specifications assigned the advisor to the `insight` tier (Sonnet-class), the advisor now executes on the **`auxiliary`** tier (Haiku-class).
* **Rationale:** The prompt is heavily constrained (capped at 120 words / 300 output tokens, temperature 0.4) and consumes a pre-aggregated XML `<facts>` block rather than raw receipts. This is an extraction and summarization task suitable for the faster and cheaper auxiliary model.

## 3. Execution & Concurrency Shape

The advisor cron executes via a bounded concurrency model to ensure execution is fast and doesn't time out:

* **Bounded Concurrency:** The cron processes eligible tenants concurrently using a promise pool capped at **`MAX_CONCURRENCY = 8`**.
* **Safety Timeout:** The Lambda's timeout is configured at **300 seconds** to act as a fallback safety net.
* **Failure Isolation:** Bedrock invocation failures are isolated; an exception during one tenant's advisor generation does not abort the cohort run.
* **Deferred Batch Inference:** Bedrock Batch Inference (`CreateModelInvocationJob`) was evaluated but deferred. Bedrock batch jobs enforce a minimum threshold of 100 records per job. Given Wobblio's early capacity envelope (~4k MAU, with premium users as a subset), batch inference would fail to meet the minimum batch size floor and is deferred to Phase 2.

## 4. Database Schema & Storage Constraints

The advisor recommendations are saved to the `weekly_advisor` table:

```sql
CREATE TABLE weekly_advisor (
  tenant_id    UUID        PRIMARY KEY REFERENCES app_user(id),
  week_start   DATE        NOT NULL,
  body         TEXT        NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Key Storage Constraints
* **Latest Only:** The table uses `tenant_id` as the `PRIMARY KEY`. Handlers save recommendations via an `ON CONFLICT (tenant_id) DO UPDATE` query. This means **only the latest weekly recommendation is retained** per user.
* **Historical Retention Discrepancy:** While the backlog (`PENDENCIAS.md`) requests retaining the last 4 months of weekly advisor recommendations, the current database schema does not support historical tracking. Supporting history would require migrating `weekly_advisor` to a composite primary key of `(tenant_id, week_start)`.
