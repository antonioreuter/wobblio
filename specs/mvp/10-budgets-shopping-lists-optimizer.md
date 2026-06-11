# 10 — Budgets, Shopping Lists & Route Optimizer

**Epic 8 | Phase 4 | Premium feature core**

## Overview

Budget definitions with 85%/100% alerts (EventBridge cron-driven), shopping list management with offline mobile support, and the split-route optimizer that makes the price engine actionable.

## Dependencies

- [04 — Authentication & Waitlist](./04-authentication-waitlist.md)
- [07 — Core Ingestion Pipeline](./07-core-ingestion-pipeline.md) (transaction-date budget attribution)
- [08 — Data Intelligence Layer](./08-data-intelligence-layer.md) (price observations for optimizer)
- [09 — Households](./09-households.md) (member-scoped budgets)

## Budget System

### Budget Definition

Each budget:
- `scope`: TOTAL (all spend), CATEGORY (one category), or MEMBER (one household member)
- `period`: WEEK or MONTH
- `amount`: the limit
- `cycle_start`: start of the current period

**Budget accumulation rule:** spend attributed by `invoice.transaction_date`, falling back to `invoice.created_at` when `transaction_date` is unparseable. Backdated invoices landing in a **closed** period do not re-fire alerts.

### Alert Mechanism

EventBridge cron (`budget-recycler` Lambda runs nightly):
1. For each active budget: recompute `accumulated` from invoices in current period
2. Check 85% threshold: if `accumulated ≥ 0.85 × amount` AND `alert_85_fired = false` → fire SNS push notification, set flag
3. Check 100% threshold: if `accumulated ≥ amount` AND `alert_100_fired = false` → fire alert, set flag
4. Period rollover: when `cycle_start + period < today` → reset `accumulated = 0`, clear both alert flags, set new `cycle_start`

**Quota:** PREMIUM users can define up to 10 budget definitions (enforced on creation).

## Shopping Lists

- 3 active lists (STANDARD) / 10 active lists (PREMIUM) — enforced on creation
- List items: `free_text` + optional resolved `product_id` (from autocomplete against product table)
- Autocomplete searches: `ACTIVE` global products ∪ tenant's own PROVISIONAL products (§6.8)
- **Offline support (mobile):** locally encrypted cache of list items; check-off persists offline; sync on reconnect; last-write-wins per item
- Completed list: set `is_active = false`, `completed_at = now()`

## Split-Route Optimizer (§6.5.3)

Premium feature. Input: a shopping list with product-resolved items.

### Algorithm

1. Build price matrix: `product × candidate_merchants` (merchants with sufficient regional data in user's region)
2. Compute single-best-store baseline: minimum over merchants of Σ best-known prices; missing cells filled with user's historical average for that product
3. Compute unconstrained minimum: Σ per-product minima
4. If `unconstrained_min` saves more than SSM threshold (`/wobblio/config/routing/min_split_saving`, default €5.00) vs. baseline:
   - Partition greedily into ≤`max_stores` (default 3) sub-lists
   - Merge any sub-list with marginal saving < €1.50 into the main store
5. Output: per-store sub-lists with expected prices, total expected saving, per-line confidence (observation count + age)

Free-text items that match no product → excluded from optimization, assigned to primary store.

### Output UI

Mobile:
- `Optimize route` button (Premium) on list detail screen
- Results: store-grouped sections with savings headline ("Save €7.40 across 2 stores")
- Per-line: expected price + confidence indicator
- WhatsApp share button per sub-list

Web:
- Same on Shopping Lists page
- Optional: print/export sub-lists

### Weekly AI Savings Advisor (Prompt B.5)

One Bedrock call per Premium user per week (EventBridge cron). Model role: `insight` (Sonnet-class).

Input: pre-aggregated system-computed facts only (never raw invoices, never other tenants' data):
- `spend_this_week` vs `last_week` (delta %)
- `budget_status` (per-budget remaining)
- `price_findings` (product, your price, cheapest regional price, merchant, observation count — k≥3 enforced before entering prompt)
- `split_route_estimate` (saving, store count) or null

Output: ≤120 words plain text, ≤3 findings, no emoji, no financial advice beyond grocery shopping, in user's language.

Stored in `invoice` or a weekly advisor table; surfaced as a card on Home (mobile) and Dashboard (web).

---

## Checklist

### Budget Management Endpoints
- [ ] `POST /budgets` — create budget definition (PREMIUM, enforce ≤10 limit)
- [ ] `GET /budgets` — list user's budgets with current accumulated + alert status
- [ ] `PATCH /budgets/{id}` — update amount/period
- [ ] `DELETE /budgets/{id}` — remove budget

### Budget Accumulation & Alerts
- [ ] `budget-recycler` EventBridge cron Lambda (nightly)
- [ ] Accumulation query: sum invoices by `transaction_date` (fallback `created_at`) within `[cycle_start, cycle_start + period)`
- [ ] 85% alert: SNS push + web notification, set `alert_85_fired = true`, no re-fire
- [ ] 100% alert: SNS push + web notification, set `alert_100_fired = true`, no re-fire
- [ ] Period rollover: reset counters, clear flags, advance `cycle_start`
- [ ] Backdated invoice check: invoices landing in a closed period do not re-fire alerts
- [ ] Member-scoped budget: filter invoices by `uploaded_by_user_id` for `MEMBER` scope

### Shopping List Endpoints
- [ ] `POST /lists` — create list (enforce active limit by role)
- [ ] `GET /lists` — list active lists with item counts
- [ ] `GET /lists/{id}` — list detail with all items
- [ ] `POST /lists/{id}/items` — add item (free_text + optional product search)
- [ ] `PATCH /lists/{id}/items/{item_id}` — update item (check, uncheck, edit text/product)
- [ ] `DELETE /lists/{id}/items/{item_id}` — remove item
- [ ] `POST /lists/{id}/complete` — mark list complete

### Product Autocomplete
- [ ] `GET /products/search?q=...` — search ACTIVE products ∪ tenant's own PROVISIONAL products
- [ ] Trgm-based fuzzy search for partial match (e.g., "melk" → "Halfvolle Melk")
- [ ] Return: product_id, display_name, brand, category, pack size

### Shopping List Offline Support (Flutter)
- [ ] Local encrypted cache (Hive or similar) for list items
- [ ] Offline check-off with timestamp
- [ ] Background sync on reconnect: last-write-wins per item based on `updated_at`
- [ ] Conflict resolution: optimistic lock or timestamp-based merge
- [ ] Visual sync status indicator

### Split-Route Optimizer
- [ ] `POST /lists/{id}/optimize` — trigger optimization (PREMIUM only)
- [ ] Price matrix construction: query `price_observation` for product × merchant within user's region
- [ ] Single-best-store baseline computation
- [ ] Unconstrained minimum computation
- [ ] Greedy partition into ≤`max_stores` sub-lists (€1.50 marginal saving threshold)
- [ ] Free-text (unresolved) items assigned to primary store
- [ ] Response: per-store sub-lists, expected prices, total saving, per-line confidence
- [ ] SSM threshold read: `min_split_saving`, `max_stores`

### Optimizer UI (Mobile)
- [ ] `Optimize route` button on list detail (premium-gated)
- [ ] Store-grouped result view with savings headline
- [ ] Per-line confidence indicator (observation count + age)
- [ ] WhatsApp share button per store sub-list

### Optimizer UI (Web)
- [ ] `Optimize route` action on Shopping Lists page
- [ ] Same result view as mobile (store-grouped, savings headline)
- [ ] Print/copy actions

### Weekly AI Savings Advisor
- [ ] `weekly-advisor` EventBridge cron Lambda (runs weekly, e.g., Sunday night)
- [ ] Targets only Premium users with ≥1 invoice in the past week
- [ ] Pre-aggregate all required facts server-side before Bedrock call
- [ ] Enforce k≥3 on price findings before including in prompt (§6.5)
- [ ] Bedrock call with B.5 prompt (Sonnet-class insight model, SSM-configured)
- [ ] Result stored and surfaced as advisor card on Home/Dashboard
- [ ] Old advisor card replaced each week (not accumulated)

### Budget UI (Mobile)
- [ ] Budget bars on Home screen (progress to limit, 85% amber tick, 100% red)
- [ ] Budget management screen in Settings/Profile

### Budget UI (Web)
- [ ] Budgets page: list with progress bars, edit/delete, create new
- [ ] 85% tick mark visual on progress bars
- [ ] Alert history: when 85%/100% was last triggered
