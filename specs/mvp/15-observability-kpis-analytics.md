# 15 — Observability, KPIs & Analytics

**Epic 14 (full) | Phase 5 | Operational excellence and business intelligence**

## Overview

Full CloudWatch dashboard and alarm inventory, business KPI aggregation into `kpi_daily`, payment analytics, and S3/Athena long-term analytics. The Phase 1 minimal slice (cost alarm + structured logging + SNS topic) is a prerequisite; this spec covers everything added in Phase 5.

## Dependencies

- [03 — Observability Foundation](./03-observability-foundation.md) (SNS ops topic, structured logging, budgets)
- [07 — Core Ingestion Pipeline](./07-core-ingestion-pipeline.md) (ingestion metrics)
- [08 — Data Intelligence Layer](./08-data-intelligence-layer.md) (AI spend ledger)
- [05 — Billing & Stripe](./05-billing-stripe.md) (payment_transaction table)

## CloudWatch Dashboard

One dashboard per environment: `wobblio-{env}-ops`.

Custom metrics emitted via Embedded Metric Format (no separate metric publishing agents). X-Ray active tracing on API handlers + ingestion worker, sampled at 10%.

## Alarm Inventory

All alarms route to the SNS ops topic (`wobblio-ops-{env}`).

| Area | Metric / Condition | Threshold |
|---|---|---|
| Ingestion | DLQ depth | >0 for 5 min |
| Ingestion | Oldest SQS message age | >15 min |
| Ingestion | `FAILED_PROCESSING` rate | >5% of daily ingestions |
| OCR/parse quality | Schema-validation retry rate | >10% daily |
| OCR/parse quality | Feedback DOWN-ratio | >20% daily, min 10 votes |
| Lambda | Errors per function group | >1% over 15 min |
| Lambda | Throttles | >0 sustained 15 min |
| API Gateway | 5xx rate | >1% over 15 min |
| API Gateway | p99 latency | >2s over 15 min |
| RDS | CPU credit balance (t3-specific) | <50 credits |
| RDS | Connections | >60 of ~85 |
| RDS | Free storage | <4 GiB |
| RDS | CPU utilization | >60% sustained 1h (scaling trigger) |
| S3 / upload path | Presign-confirmed uploads with no ledger row after 30 min | >0 |
| Auth | Cognito sign-in failure spike | >5× 7-day baseline |
| Billing | Webhook handler errors | >0 |
| GDPR | Export/purge job failures | >0 |
| Cost | AWS Budgets | 50% / 80% / 100% of €100/mo |
| Cost | Cost Anomaly Detection | anomaly >€10 |
| Cost | `ai_spend_ledger` daily total | >SSM daily AI budget |

The RDS credit balance alarm is the single most important DB alarm on db.t3.micro — it is the early warning for the scaling-ladder decision (§7.3.1).

## Business KPI System

### Implementation

One nightly EventBridge cron Lambda computes all KPIs in a single pass and upserts into `kpi_daily(metric_date, metric_name, value, dimensions)`. KPIs read from `kpi_daily`, never computed live against production tables.

Monthly: previous month's `kpi_daily` rows + `payment_transaction` snapshot exported as Parquet to `s3://wobblio-analytics-{env}/kpi/yyyy/mm/` → Glue table + Athena.

`DAU/MAU`: sourced from `app_user.last_active_at`, updated at most once per hour per user by the API authorizer path (throttled write).

### KPI Catalog

| Group | KPIs | Source |
|---|---|---|
| Users | new registrations, total registered, DAU, MAU, waitlist size | `app_user`, `system_counter` |
| Subscription | new premium subs, total premium, conversion rate (premium ÷ registered), churn rate (cancellations ÷ active), MRR (active monthly × €2.50 + annual × €25/12) | `payment_transaction`, `app_user.role` |
| Invoices | total scanned (cumulative + per day), avg invoices/active user, parse success rate (PARSED ÷ ingested), schema-retry rate (OCR quality proxy), feedback score (UP ÷ votes), needs-review rate, duplicate-detection rate, tag-edit rate | `invoice`, `ingestion_ledger`, `invoice_feedback` |
| Operational | avg processing time (ledger created→completed), cost per processed invoice (day's ai_spend ÷ ingestions), export requests, deletion requests, quarantined-observation rate | `ingestion_ledger`, `ai_spend_ledger`, `data_request`, `price_observation` |

## Payment Analytics (Audit & Reconciliation)

`payment_transaction` table: operational source of truth for revenue KPIs and support lookups.

S3 billing archive (`wobblio-billing-archive-{env}`): immutable audit trail, Glue + Athena queryable.

Monthly close procedure (manual, 10 min):
1. Compare Stripe payout report against `SELECT` totals from `payment_transaction` for the month
2. Mismatch → replay missing webhook from Stripe dashboard (idempotency makes this safe)

---

## Checklist

### CloudWatch Dashboard
- [ ] `wobblio-{env}-ops` dashboard created in CDK
- [ ] Widgets: ingestion metrics (queue depth, age, success/failure rates)
- [ ] Widgets: Lambda errors and throttles per function group
- [ ] Widgets: API Gateway 5xx rate and p99 latency
- [ ] Widgets: RDS CPU, connections, storage, credit balance
- [ ] Widgets: AI spend (tokens + cost by model role, daily bar chart)
- [ ] Widgets: business KPIs (registrations, premium count, conversion rate, feedback score)

### Alarm Definitions (all alarms route to SNS ops topic)
- [ ] Ingestion DLQ depth >0 for 5 min
- [ ] Ingestion queue oldest message age >15 min
- [ ] FAILED_PROCESSING rate >5% (custom metric from worker EMF)
- [ ] Schema-validation retry rate >10% (custom metric)
- [ ] Feedback DOWN-ratio >20% daily with min 10 votes (custom metric from nightly KPI job)
- [ ] Lambda errors >1% per function group (15-min period)
- [ ] Lambda throttles >0 sustained 15 min
- [ ] API Gateway 5xx >1% (15-min period)
- [ ] API Gateway p99 latency >2s (15-min period)
- [ ] RDS CPU credit balance <50 (t3 credit metric)
- [ ] RDS connections >60
- [ ] RDS free storage <4 GiB
- [ ] RDS CPU utilization >60% sustained 1h
- [ ] Upload path anomaly: presigned uploads without ledger entry after 30 min
- [ ] Auth spike: Cognito sign-in failures >5× 7-day baseline
- [ ] Billing webhook errors >0
- [ ] GDPR export/purge job failures >0

### X-Ray Tracing
- [ ] X-Ray active tracing enabled on API Gateway stage
- [ ] X-Ray active tracing enabled on ingestion worker Lambda
- [ ] Sampling rate: 10% on API handlers + worker
- [ ] X-Ray service map showing API→SQS→worker→Bedrock chain

### Nightly KPI Aggregation Lambda
- [ ] EventBridge cron rule: nightly at 02:00 UTC
- [ ] Compute all KPIs in single pass (see KPI catalog above)
- [ ] Upsert into `kpi_daily` (idempotent: `ON CONFLICT DO UPDATE`)
- [ ] Weekly + monthly roll-ups computed in the same job
- [ ] `last_active_at` update logic: throttled to once per hour per user in authorizer path
- [ ] Monthly Parquet export: on 1st of month, export previous month to S3 analytics bucket

### Feedback DOWN-Ratio Alarm
- [ ] Nightly KPI job computes daily DOWN-ratio and writes to `kpi_daily` as `feedback_down_ratio`
- [ ] CloudWatch alarm reads this custom metric (emitted via EMF from KPI job)
- [ ] Threshold: >20% with min 10 votes — filters out low-volume noise

### Payment Analytics
- [ ] Glue table over `s3://wobblio-billing-archive-{env}` (partition by yyyy/mm)
- [ ] Athena named query examples: monthly revenue, failed payments, refund analysis
- [ ] MRR metric in nightly KPI job: active monthly plans × €2.50 + annual × €25/12
- [ ] Churn rate metric: cancellations ÷ active subs (from `payment_transaction`)

### Admin Console KPI Page
- [ ] `GET /admin/kpis` endpoint reads `kpi_daily` (date range, metric names)
- [ ] Stat cards: key metrics with day-over-day delta
- [ ] 90-day sparklines (time-series query on `kpi_daily`)
- [ ] Feedback score trend (OCR quality proxy)
- [ ] Link to Athena for deep-dive (external URL to AWS console or embedded query)

### Log Retention
- [ ] All CloudWatch log groups: 30-day hot retention
- [ ] Log archive export to S3: configure CW log export for logs older than 30 days (optional, low priority)
