# 10a — Budgets

**Epic 8 | Phase 4 | Premium feature core**

## Overview

Budget definitions with 85%/100% alerts, driven by a nightly EventBridge cron. Unchanged by the shopping-list refactor in [10b](./10b-shopping-lists.md)/[10c](./10c-split-route-optimizer.md) — extracted here purely to give budgets their own file.

## Dependencies

- [04 — Authentication & Waitlist](../04-authentication-waitlist.md)
- [07 — Core Ingestion Pipeline](../07-core-ingestion-pipeline.md) (transaction-date budget attribution)
- [09 — Households](../09-households.md) (member-scoped budgets)

## Budget Definition

Each budget:
- `scope`: TOTAL (all spend), CATEGORY (one category), or MEMBER (one household member)
- `period`: WEEK or MONTH
- `amount`: the limit
- `cycle_start`: start of the current period

**Budget accumulation rule:** spend attributed by `invoice.transaction_date`, falling back to `invoice.created_at` when `transaction_date` is unparseable. Backdated invoices landing in a **closed** period do not re-fire alerts.

## Alert Mechanism

EventBridge cron (`budget-recycler` Lambda runs nightly):
1. For each active budget: recompute `accumulated` from invoices in current period
2. Check 85% threshold: if `accumulated ≥ 0.85 × amount` AND `alert_85_fired = false` → fire SNS push notification, set flag
3. Check 100% threshold: if `accumulated ≥ amount` AND `alert_100_fired = false` → fire alert, set flag
4. Period rollover: when `cycle_start + period < today` → reset `accumulated = 0`, clear both alert flags, set new `cycle_start`

**Quota:** PREMIUM users can define up to 10 budget definitions (enforced on creation).

---

## Checklist

### Budget Management Endpoints
- [x] `POST /budgets` — create budget definition (PREMIUM, enforce ≤10 limit)
- [x] `GET /budgets` — list user's budgets with current accumulated + alert status
- [x] `PATCH /budgets/{id}` — update amount/period
- [x] `DELETE /budgets/{id}` — remove budget

### Budget Accumulation & Alerts
- [x] `budget-recycler` EventBridge cron Lambda (nightly) — `Source/backend/src/handlers/cron-budget-reset/index.ts`
- [x] Accumulation query: sum invoices by `transaction_date` (fallback `created_at`) within `[cycle_start, cycle_start + period)`
- [x] 85% alert: SNS push + web notification, set `alert_85_fired = true`, no re-fire
- [x] 100% alert: SNS push + web notification, set `alert_100_fired = true`, no re-fire
- [x] Period rollover: reset counters, clear flags, advance `cycle_start`
- [x] Backdated invoice check: invoices landing in a closed period do not re-fire alerts
- [x] Member-scoped budget: filter invoices by `uploaded_by_user_id` for `MEMBER` scope

### Budget UI (Mobile)
- [ ] Budget bars on Home screen (progress to limit, 85% amber tick, 100% red) — deferred to Epic 16 mobile build
- [ ] Budget management screen in Settings/Profile — deferred to Epic 16 mobile build

### Budget UI (Web)
- [x] Budgets page: list with progress bars, edit/delete, create new — `Source/webapp/src/app/(app)/budgets/page.tsx`
- [x] 85% tick mark visual on progress bars
- [x] Alert history: when 85%/100% was last triggered
