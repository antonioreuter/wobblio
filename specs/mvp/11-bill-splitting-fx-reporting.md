# 11 — Bill Splitting, FX & Reporting

**Epic 9 | Phase 4 | Premium reporting and social sharing features**

## Overview

Proportional bill splitting with WhatsApp export, multi-currency harmonization using ECB daily FX rates, and the full reporting suite including the 3-product/6-month price comparison chart.

## Dependencies

- [04 — Authentication & Waitlist](./04-authentication-waitlist.md)
- [07 — Core Ingestion Pipeline](./07-core-ingestion-pipeline.md)
- [08 — Data Intelligence Layer](./08-data-intelligence-layer.md) (price observations for comparison chart)
- [09 — Households](./09-households.md) (household reporting context)

---

## Bill Splitting (Premium)

### Splitting Rules

- Entry point: any parsed invoice (typically `document_kind_hint=RESTAURANT_BILL`, but works on any)
- Assign whole line items or fractional units to named participants
- Taxes, tips, and service fees: **allocated proportionally to subtotal shares** — never recomputed from rates
- The splitter operates on receipt-printed totals at all times (correct across jurisdictions with mixed-rate line items — e.g., NL 9%/21% BTW)
- WhatsApp-ready summary export

### Data Model

```sql
bill_split      (id, invoice_id, created_at)
bill_split_line (split_id, line_id, participant_name_enc, fraction NUMERIC)
```

`participant_name_enc` is KMS-encrypted (field-level encryption, §7.5).

### Proportional Fee Allocation Formula

For participant P:
```
P_subtotal = Σ (line_total × fraction) for all lines assigned to P
P_share = P_subtotal / total_items_subtotal
P_fees = (taxes + tips + service_fees_as_printed) × P_share
P_total = P_subtotal + P_fees
```

All inputs from the parsed invoice — never re-derived from rates.

### WhatsApp Export Format

```
🧾 [Merchant] — [Date]

[Name]: €12.50
  • [Item 1] ×1 — €9.00
  • [Item 2] ×0.5 — €3.50
  + fees: €0.80
  Total: €13.30

[Name 2]: €8.20
  ...

Total: €34.00
```

---

## FX Pipeline (Multi-Currency)

### ECB Daily Reference Rates

Source: ECB free API (no key required, stable). Fetched by `fx-rates-daily` EventBridge cron Lambda.

- Fetch previous day's rates at 00:00 UTC
- Store in `fx_rate(date, base='EUR', quote, rate)` table
- On failure: retry 3x, then log alarm + fall back to previous day's stored rate

### Invoice Currency Harmonization

At ingestion time:
- If `invoice.currency == user.home_currency`: no conversion needed
- Otherwise: look up `fx_rate` for `(transaction_date, invoice.currency → home_currency)`
- Store `invoice.total_home_currency` and `invoice.fx_rate_used`
- Fallback if no rate for exact date: use latest available rate before transaction date

All reports, budgets, and comparisons use `total_home_currency`. The transaction-date FX rate is preserved forever in `fx_rate_used` — historical comparisons remain honest as rates change.

---

## Reporting Suite

### Spend Breakdown (hierarchical drill-down) — `GET /reports/spend`

The "where does my money go?" report: a line-rooted drill from **category → merchant →
item-category → items**, in the caller's home currency, capped at a rolling **90-day** window.
Amended 2026-07-07 (loosens the earlier free-tier rule below).

- **Line-rooted attribution:** every level sums `invoice_line.line_total` converted to home
  currency (`× COALESCE(fx_rate_used, 1)`) and rolled up via the taxonomy `macroCategoryId`
  helper, so a level's node amounts always sum to the parent total. Null-category lines fall into
  an explicit **Uncategorized** bucket; discounts/deposits net negative (shown signed).
- **Spend-counting semantics reuse budgets:** `status IN ('PARSED','NEEDS_REVIEW')`, dated by
  `COALESCE(transaction_date, created_at::date)` — the same receipts `compute_budget_spend` counts.
- **Tier gate:** STANDARD drills **category → merchant**; **item-category and item levels are
  PREMIUM** (`merchantId` present ⇒ 403 `PremiumRequiredError` for STANDARD → web-checkout upsell).
- **Filters:** period presets `THIS_WEEK | THIS_MONTH | LAST_90D | CUSTOM` (≤90 days, enforced
  server-side); region defaults to the caller's home region (invoice `location_region_code`),
  with an **All regions** option. Region '' ⇒ no location filter.
- **Level inferred from params:** none → categories, `+categoryId` → merchants,
  `+merchantId` → item-categories, `+itemCategoryId` → items (grouped by product with per-trip
  occurrences). Web renders a donut (L1) + ranked bars + table toggle + breadcrumb; mobile renders
  ranked bars + breadcrumb (custom date range and arbitrary-region picking are web-first).

### Free Tier (other reports)

- Totals by top-level category for the current and previous month only
- Tag filtering within 2-month window

### Premium Reporting

All views use `total_home_currency` for cross-currency comparisons.

**Dashboard:**
- MTD spend vs. last month delta
- Spend-over-time area chart (30/90/365 days)
- Category breakdown (donut chart)
- Budget health summary

**Spend Breakdown drill-down (see the dedicated section above):**
- Category → merchant (all tiers) → item-category → items (PREMIUM)
- Line-rooted, home currency, 90-day window, region filter

**3-Product / 6-Month Comparison Chart (the flagship):**
- User selects up to 3 products (autocomplete, PREMIUM)
- Shows weekly median `normalized_unit_price` per merchant per region over trailing 26 weeks
- Current-merchant line emphasized
- Discounted observations rendered as distinct markers (promo prices are signal, not noise)
- Stale cells (no observation in 60 days) greyed with age label
- k≥3 threshold: cells with fewer than 3 distinct observations not rendered
- Data sourced exclusively from `price_observation` (never from other tenants' invoices)

**Personal Price History:**
- Available from day 1 for any product the user has scanned (even PROVISIONAL products)
- "You paid €1.39 — 8% more than last month"

---

## Checklist

### FX Pipeline
- [ ] `fx-rates-daily` EventBridge cron Lambda (runs daily at 00:00 UTC)
- [ ] Fetch ECB daily reference rates for all major currencies
- [ ] Upsert into `fx_rate(date, base, quote, rate)` table
- [ ] Fallback: if fetch fails, use previous day's stored rate + CloudWatch alarm
- [ ] Invoice ingestion: lookup FX rate, store `total_home_currency` and `fx_rate_used`
- [ ] Fallback in ingestion: use latest available rate before transaction date

### Bill Splitting Endpoints
- [ ] `POST /invoices/{id}/splits` — create split session for an invoice
- [ ] `GET /invoices/{id}/splits/{split_id}` — get current split state
- [ ] `PATCH /invoices/{id}/splits/{split_id}/lines/{line_id}` — assign line to participant + fraction
- [ ] `DELETE /invoices/{id}/splits/{split_id}/lines/{line_id}/assignment` — remove assignment
- [ ] `GET /invoices/{id}/splits/{split_id}/summary` — compute totals per participant

### Proportional Fee Calculation
- [ ] Server-side: compute `P_share` and `P_fees` for each participant from printed totals
- [ ] Handle tip, service fee, multiple tax lines as separate fee buckets (all proportional)
- [ ] Edge case: 100% assignment of a line to one participant (fraction = 1.0)
- [ ] Edge case: fractional split (e.g., starter shared by 3 people, fraction = 1/3 each)

### WhatsApp Export
- [ ] `GET /invoices/{id}/splits/{split_id}/whatsapp` — returns formatted text
- [ ] Format: emoji header, per-participant breakdown with line items + fees + total
- [ ] Mobile: native Share sheet with pre-populated WhatsApp message
- [ ] Web: copy-to-clipboard button

### Bill Split UI (Mobile)
- [ ] Entry from parsed invoice card
- [ ] Participant name chips (add/remove)
- [ ] Line-item list with assignment tap (tap line → assign to chip / fraction stepper)
- [ ] Fee breakdown shown proportionally
- [ ] WhatsApp export button with pre-filled summary

### Bill Split UI (Web)
- [ ] Right drawer or dedicated view from invoice
- [ ] Same participant chips + line assignment UX
- [ ] WhatsApp export button

### Reporting Endpoints
- [x] `GET /reports/spend?period=&from=&to=&country=&region=&categoryId=&merchantId=&itemCategoryId=`
      — hierarchical spend breakdown; level inferred from params; 90-day cap; `merchantId` ⇒ PREMIUM
      (built 2026-07-07: `SpendReportService` + `SpendReportQueryAdapter`, line-rooted, home currency)
- [ ] `GET /reports/comparison?product_ids=...&region=...` — 3-product/6-month chart data (PREMIUM, max 3 products)
- [x] Tier gating: STANDARD reaches category+merchant; item levels PREMIUM (403). Range capped 90 days for all.

### Price Comparison Query
- [ ] Weekly median `normalized_unit_price` per merchant per region (trailing 26 weeks)
- [ ] k≥3 threshold enforced: suppress cells with <3 distinct non-quarantined observations
- [ ] Staleness: cells with no observation in 60 days → grey flag in response
- [ ] Discounted observations: separate field/flag (not blended into median)
- [ ] STANDARD users: endpoint returns 403 for comparison queries

### Personal Price History
- [ ] Available for all scanned products (including PROVISIONAL, from user's own invoices)
- [ ] "First purchase — we'll track this for you" message for single-observation products
- [ ] % change vs. last scan of same product

### Reporting UI (Web)
- [ ] Dashboard: stat-card row, spend-over-time area chart, category donut
- [ ] Reports page: product selector (max 3 autocomplete), comparison chart with merchant lines
- [ ] Discount markers on comparison chart
- [ ] Data-table toggle for every chart (accessibility)
- [ ] Stale cell greying with age label
- [ ] Merchant drill-down: product list with sparklines

### Reporting UI (Mobile)
- [ ] Insights tab: category donut, budget status, weekly advisor card
- [ ] Hand-off CTA to web app for deep analysis
- [ ] Merchant drill-down: basic view on mobile (full version on web)
