# 07 — AI-Spend Dashboard

**Epic 10 | Phase 5 | Aggregate visibility into Bedrock token spend**

## Overview

Operator view of Bedrock token spend over time. After the 2026-06-22 amendment this is an
**aggregate-only** dashboard: total tokens (input + output) and estimated cost per day, segmented by
model role, read from `kpi_daily` (populated nightly by `cron-ingestion-metrics-rollup` from
`bedrock_usage` structured logs).

Parent: [12 — Admin Console](../12-admin-console.md).

## What changed (amendment 2026-06-22 — `remove-ai-spend-cap`)

- **`ai_spend_ledger` dropped.** The per-call, per-tenant ledger was removed (all historical rows were
  dead weight; only "today's total" was ever read, for the cap). Source is now the `kpi_daily` rollup of
  `bedrock_usage` logs.
- **Per-tenant daily AI-spend cap removed entirely**, no replacement. AI cost is bounded by the **weekly
  invoice quota** (`QuotaService`, invariant #6). Abuse is surfaced via `event: quota_block` logs.

Consequences for this dashboard:

- **Per-tenant top-spenders table — dropped.** There is no per-tenant spend store anymore.
- **Cap-breach indicator — dropped.** There is no per-tenant cap to breach.

To reinstate either, a **new per-tenant/per-model/per-day aggregate table** must be built (upsert on each
Bedrock call). That is out of scope here — propose it as its own amendment if the need is demonstrated;
do not restore `ai_spend_ledger`.

## Dependencies

- [00 — Access Control, Routing & Audit](./00-access-control-routing-audit.md) (admin route module)
- [15 — Observability, KPIs & Analytics](../15-observability-kpis-analytics.md) (`bedrock_usage` logs, `kpi_daily`, rollup cron)

## Endpoint

- `GET /admin/ai-spend?from=...&to=...` — daily aggregate totals (tokens + est. cost) by model role,
  read from `kpi_daily`. Read-only (no audit). `kpi_daily` is globally readable — no tenant context.

Confirm the rollup cron actually emits per-model-role token/cost rows into `kpi_daily`; if a role is
missing, flag it as a gap for [15](../15-observability-kpis-analytics.md) rather than computing ad hoc.

## UI

- Daily bar chart: tokens + estimated cost, segmented by model role.
- Date-range picker (default last 30 days).

## Checklist

- [ ] `GET /admin/ai-spend?from&to` — daily aggregate totals by model role (from `kpi_daily`)
- [ ] Verify per-model-role token/cost rows exist in the rollup; flag missing ones to Epic 15
- [ ] Bar chart + date-range picker UI, `data-testid` on controls
- [ ] No reference to `ai_spend_ledger` or a per-tenant cap (both removed)
- [ ] `npm run skill:hexagonal-architecture-validator` exit 0; domain unit tests with mocked repo port
