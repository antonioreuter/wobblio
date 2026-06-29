# 06 — KPI Pipeline Comparison

**Non-Functional 01 · Phase 3/5 · Side-by-side pipeline performance**

Parent: [../01-data-ai-pipeline.md](../01-data-ai-pipeline.md) §6 · Index: [README](./README.md)

## Overview

Roll up `invoice_telemetry` into `kpi_daily` with a `pipeline_type` dimension and render a
"Pipeline Performance Comparison" tab in the admin KPI dashboard so operators can compare
legacy vs Strands on latency, cost, review rate, and feedback.

## Dependencies

- [01 — Ingestion Telemetry](./01-ingestion-telemetry.md) (`invoice_telemetry` + `pipeline_type`)
- [08 — KPI Dashboard](../../mvp/admin-console/08-kpi-dashboard.md) (`/admin/kpis` + dashboard)
- Reuses: `cron-ingestion-metrics-rollup`, `KpiDailyRepositoryAdapter` (UPSERT with
  `dimensions jsonb`), admin `(console)/page.tsx` card/chart patterns.

## Design

### 1. Rollup extension

Extend `cron-ingestion-metrics-rollup` to group ingestion telemetry by `pipeline_type` and
UPSERT into `kpi_daily` with `dimensions->>'pipeline_type'`:

- `avg_processing_time_ms`, `cost_per_invoice`, `needs_review_rate`, `feedback_down_ratio`.

`kpi_daily` is globally readable (no tenant context) — keep these rows aggregate-only, no
per-tenant data. (Per-tenant cost stays in `invoice_telemetry` behind RLS /
`admin_pipeline_cost_deficit`.)

### 2. Dashboard tab

Extend the existing `GET /admin/kpis?metrics&from&to` read (no new endpoint shape; query the
new metric names + filter by the `pipeline_type` dimension).

- **Comparison cards** (Legacy vs Strands): average latency, average cost per ingest, review
  rate, feedback UP/DOWN ratio.
- **Time-series charts**: 90-day multi-line latency + cost-per-invoice for both pipelines.
- `data-testid` on cards + charts.

## Checklist

- [ ] Rollup writes `kpi_daily` rows with `pipeline_type` dimension for the four metrics
- [ ] Comparison cards (latency, cost, review rate, feedback) — Legacy vs Strands
- [ ] 90-day multi-line time-series (latency, cost per invoice)
- [ ] `data-testid` on cards/charts; mocked-repo unit test
- [ ] `npm run skill:hexagonal-architecture-validator` exit 0
