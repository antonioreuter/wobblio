# 12f — Analytics Dashboards (AI-Spend + KPIs)

**Epic 10 | Phase 5 | Parent: [12 — Admin Console](../12-admin-console.md)**

Two read-only dashboards: AI token spend by model role, and product KPIs. Grouped because both
read from `kpi_daily` and ship no mutations.

## Dependencies

- [12a — Admin Foundation](./12a-admin-foundation.md)
- [15 — Observability, KPIs & Analytics](../15-observability-kpis-analytics.md)

## Resolution — AI-Spend data source (spec/impl conflict)

Spec §6 originally read AI-spend from `ai_spend_ledger`. That table was **dropped** (commit
`34941e6`, 2026-06-22) when the per-tenant daily AI-spend cap was removed (memory
`project_telemetry_no_emf_kpi_daily`). **Decision:** source AI-spend from `kpi_daily`, rolled
from `bedrock_usage` structured logs by `cron-ingestion-metrics-rollup` — do NOT restore the
ledger.

Consequence: the **per-tenant top-spenders table is dropped** from this dashboard (no per-tenant
spend without the ledger). The dashboard shows aggregate spend by model role + date. State this
trade in the UI. If per-tenant spend is ever needed again, that is a separate spec re-deciding
the ledger.

## Backend

Endpoints (ADMIN-gated, read-only):

- `GET /admin/ai-spend?from&to` — daily totals (tokens in+out, est. cost) segmented by model
  role, from `kpi_daily`.
- `GET /admin/kpis?metrics&from&to` — time series from `kpi_daily` for the requested metrics.

### Reuse + rollup extension

- `KpiDailyRepositoryAdapter`, `IKpiDailyWriter`, `IngestionMetricsRollupService`,
  `handlers/cron-ingestion-metrics-rollup/index.ts`.
- Extend the rollup to emit the metrics the dashboards need if not present yet:
  - spend-by-model-role (tokens + est. cost) from `bedrock_usage` logs
  - registrations, DAU, premium count, MRR, conversion rate, churn rate
  - feedback score (UP ÷ total votes) from invoice feedback
- est. cost = tokens × per-model price; keep the price table in config (SSM, editable via 12c)
  rather than hardcoded.

## Frontend (`Source/admin/`)

- `(console)/ai-spend/page.tsx` — daily bar chart (tokens + cost by model role), date-range
  picker (default last 30 days), per-day cap-breach indicator (vs `ai/daily_spend_cap` if set).
- `(console)/kpis/page.tsx` — stat cards (registrations today, DAU, premium, MRR, conversion,
  churn), 90-day sparklines, date-range picker, feedback-score trend. Use `stat-card`.

Every chart paired with a data-table toggle (webapp accessibility rule). Tabular-nums on all
numerics.

## Open decisions

- Whether missing rollup metrics land here or in Epic 15 — 12f owns only what the dashboards
  strictly need; broader KPI work stays in 15.

## Checklist

- [ ] `GET /admin/ai-spend` reads `kpi_daily` (by model role); no ledger dependency
- [ ] `GET /admin/kpis` time-series read; metric whitelist
- [ ] Rollup extended for any missing metrics (spend-by-role, registrations, DAU, MRR, churn, feedback)
- [ ] est. cost uses an SSM price table (editable via 12c), not hardcoded
- [ ] `ai-spend/page.tsx` + `kpis/page.tsx`; charts + data-table toggle; tabular-nums
- [ ] Unit tests: query shaping, date-range bounds, est. cost calc
- [ ] Hexagonal validator exit 0

## Verification

- Seed `kpi_daily` rows; `GET /admin/ai-spend?from&to` returns daily totals by model role;
  `GET /admin/kpis?metrics=dau,mrr&from&to` returns those series. Dashboards render charts with a
  working data-table toggle. No reference to `ai_spend_ledger` anywhere.
