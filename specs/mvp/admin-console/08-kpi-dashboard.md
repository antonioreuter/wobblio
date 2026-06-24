# 08 — KPI Dashboard

**Epic 10 | Phase 5 | Business-intelligence stat cards + trends**

## Overview

Read-only KPI dashboard for operators: stat cards for today's headline numbers, 90-day sparklines, and a
feedback-score trend (proxy for OCR quality). Data comes from the `kpi_daily` table.

> **Hard prerequisite — [15](../15-observability-kpis-analytics.md) must land first.** `kpi_daily` and
> the nightly cron exist, but the rollup (`cron-ingestion-metrics-rollup`) currently writes **only
> ingestion-timing rows** (`ingestion_processing_ms_avg`, `ingestion_worker_ms_avg`, `ingestion_count`).
> The headline metrics this page shows — registrations, DAU/MAU, premium count, MRR, conversion, churn,
> feedback score — are **not produced yet**. Epic 15's business-KPI nightly job must populate them before
> this dashboard has anything to render. The endpoint/UI below are otherwise thin.

Parent: [12 — Admin Console](../12-admin-console.md).

## Dependencies

- [00 — Access Control, Routing & Audit](./00-access-control-routing-audit.md) (admin route module)
- [15 — Observability, KPIs & Analytics](../15-observability-kpis-analytics.md) (`kpi_daily` schema + rollup cron)

## Endpoint

- `GET /admin/kpis?metrics=...&from=...&to=...` — time-series read over `kpi_daily`
  (`metric_date`, `metric_name`, `value`, `dimensions`). Read-only (no audit). `kpi_daily` is globally
  readable — no tenant context required.

Confirm each required metric is actually produced by the rollup cron; if a headline metric (e.g. MRR,
churn, conversion rate) is not yet rolled up, note it as a gap for [15](../15-observability-kpis-analytics.md)
rather than computing it ad hoc in the endpoint.

## UI

- Stat cards: registrations today, DAU, premium subscribers, MRR, conversion rate, churn rate.
- 90-day sparklines for key metrics (time-series query on `kpi_daily`).
- Date-range picker.
- Feedback score (UP ÷ total votes) trend.

## Checklist

- [ ] `GET /admin/kpis?metrics&from&to` — time-series read over `kpi_daily`
- [ ] Verify required metrics exist in the rollup; flag missing ones to Epic 15
- [ ] Stat cards (registrations, DAU, premium, MRR, conversion, churn)
- [ ] 90-day sparklines
- [ ] Feedback-score trend (UP ratio)
- [ ] Date-range picker; `data-testid` on cards + controls
- [ ] `npm run skill:hexagonal-architecture-validator` exit 0; domain unit tests with mocked repo port
