# 11d — Reporting Endpoints + Personal Price History

Parent: [11](../11-bill-splitting-fx-reporting.md) · Handoff: [11-00](./11-00-handoff.md) · Depends: —

> Lowest priority. Partly redundant with the existing client-side dashboard + `/price-trends` +
> `/me/stats/top-merchant`. **Confirm need before building** — some of this may stay client-side.

## Goal

Server-side reporting endpoints (all in `total_home_currency`) with tier gating, plus a personal
price-history "% vs last scan" surface.

## What already exists

- Comparison chart flagship (`/price-trends/comparison`) — DONE.
- Dashboard stat cards (MTD, delta, budget health) computed client-side from workspace data.
- `/me/stats/top-merchant`, `OwnPurchaseHistoryQueryAdapter` (own weekly medians, no k-gate).

## Design

New `handlers/api-handler/reportRoutes.ts` (`path.startsWith('/reports')`) + `core/services/reporting/ReportingService.ts` + adapters. All amounts from `invoice.total_home_currency` (falls back to `total` when FX null).

- `GET /reports/overview?period=MTD|30D|90D|YTD` — top-level category totals + MTD-vs-last-month delta.
  STANDARD: clamp window to 2 months + top-level categories only (§ free tier).
- `GET /reports/categories?period=&category_id=` — sub-category / merchant drill-down (PREMIUM).
- `GET /reports/merchants/{merchant_id}?period=` — products bought there + per-product personal
  sparkline (PREMIUM; reuse own-purchase-history query).
- **Personal price history**: `% change vs last scan` of the same product; "First purchase — we'll
  track this for you" for single-observation products. Available for all scanned products incl.
  PROVISIONAL (own `invoice_line`, RLS-scoped).

## Checklist

- [ ] `/reports/overview` + STANDARD 2-month/top-level clamp
- [ ] `/reports/categories` drill-down (PREMIUM 403 gate)
- [ ] `/reports/merchants/{id}` product list + sparklines (PREMIUM)
- [ ] Personal price-history % change + first-purchase message
- [ ] Unit + integration tests; tier-gating tests
- [ ] Web wiring only if we decide to move dashboard off client-side aggregation

## Verify

Hexagonal validator, unit, integration green; confirm STANDARD vs PREMIUM gating with seeded tenants.
