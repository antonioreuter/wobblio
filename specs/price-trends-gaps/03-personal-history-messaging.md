# 03 — Personal price-history messaging (G3)

## Problem

The spec's day-1 personal-history value proposition (§6.5.5, `specs/mvp/11-*/11d-reporting-endpoints.md`)
is explicit: **"% change vs last scan"** of the same product, and **"First purchase — we'll track
this for you"** for a single-observation product. The implementation delivers neither.

Today the legend (`reports/page.tsx:349–377`) computes a delta as
`(last − first) / first` over the **visible range's** weekly medians:

```
const delta = vals.length > 1 ? ((vals[last] - vals[0]) / vals[0]) * 100 : null
```

In market mode that's a reasonable "trend over the shown range". In **own mode** it's the wrong
metric and misleading — the user wants "you paid X, that's N% more/less than the previous time you
bought it", scan-to-scan, not week-bucket-to-week-bucket over an arbitrary window. And there is no
first-purchase affordance at all.

The blocker is data shape: `OwnPurchaseLine` only carries weekly medians (`points[]`) plus
`purchaseCount` / `lastPurchasedOn` — weekly buckets have already lost per-scan granularity, so the
"last two scans" cannot be recovered client-side.

## Required behaviour

### Backend — surface the last two purchase events
Extend `OwnPurchaseLine` (port `IOwnPurchaseHistoryQuery.ts` + adapter) with:
- `lastPrice: number | null` — unit-consistent price of the **most recent purchase event** (same
  `unit_known` decision already used for the medians: per-unit when size known, else pack price).
- `previousPrice: number | null` — the purchase event immediately before `lastPrice`; `null` when
  the product has only one purchase.
- `lastPurchasedOn` already exists — keep it.

Implementation note: add a window/ordering pass over the `lines` CTE (e.g. `row_number() OVER
(PARTITION BY product_id ORDER BY transaction_date DESC, invoice created_at DESC)`) taking rank 1
and 2. Tie-break same-day purchases deterministically (by invoice `created_at` then `id`). Exclude
discount lines from this "what did I pay" signal, or include them — **decide and document**;
recommendation: use the same regular-vs-discount split as the medians and report the regular-price
scan, falling back to the discounted one only if no regular scan exists (so "last paid" matches what
they'd expect to see next time). Keep it to one clearly-stated rule.

`currency` (from sub-spec 02) applies to these prices too — they're in the view currency.

### Webapp — own-mode legend
In **own mode** (`mode === 'own'`), replace the range delta with the spec messaging per product.
Reuse the existing helpers in `Source/webapp/src/lib/currency.ts` (do not hand-roll glyph logic):
`formatMoney(amount, { currency })` for the price and `formatDelta(value)` for the `▲/▼ N%` string.
- **≥ 2 purchases:** `last paid {formatMoney(lastPrice, {currency})}` + `{formatDelta(N)} vs previous
  scan`, where `N = (lastPrice − previousPrice) / previousPrice × 100`. Colour: up = danger, down =
  success (existing convention), always paired with the ▲/▼ glyph + text label — never colour alone
  (accessibility). `currency` comes from sub-spec 02's response field.
- **1 purchase:** show `First purchase — we'll track this for you` instead of a delta.
- Keep `lastPurchasedOn` visible as a subtle "last bought <date>" so staleness of *own* data is honest.

In **market mode**, keep the existing range delta but label it explicitly as **"over range"** (not
an unlabelled delta), so the two modes' numbers aren't silently different metrics.

## Files to touch

- `Source/backend/src/core/ports/data-intelligence/IOwnPurchaseHistoryQuery.ts` (`OwnPurchaseLine` fields)
- `Source/backend/src/infrastructure/adapters/data-intelligence/OwnPurchaseHistoryQueryAdapter.ts`
  (window function for last/previous purchase; map into the line)
- `Source/backend/src/core/services/data-intelligence/PriceTrendService.ts` (pass-through; no logic)
- `Source/webapp/src/components/workspace/use-price-trends.ts` (`OwnPurchaseLine` type: add fields)
- `Source/webapp/src/app/(app)/reports/page.tsx` (own-mode legend copy + market-mode "over range" label)

**No DDL / migration.** Additive contract change (new nullable fields).

## Tests

- **Integration** (own-history adapter): product with 3 purchases → `lastPrice`/`previousPrice` are
  the two most recent by date; single-purchase product → `previousPrice = null`; same-day tie-break
  deterministic; regular/discount rule behaves as documented.
- **Unit** (service): pass-through of the new fields.
- **Webapp unit**: own-mode legend renders "▲/▼ N% vs previous scan" for ≥2 purchases and
  "First purchase — we'll track this for you" for 1; market-mode delta labelled "over range".

## Definition of Done

- [ ] Own mode shows "last paid … · ▲/▼ N% vs previous scan" and the first-purchase message.
- [ ] Market-mode delta is explicitly labelled (no silent metric switch between modes).
- [ ] New `ownHistory[]` fields in the response; `use-price-trends.ts` updated; contract ledger updated.
- [ ] Regular-vs-discount rule for "last paid" documented in the adapter comment.
- [ ] `skill:hexagonal-architecture-validator` exit 0; backend + webapp `test:unit` green; `validate:security` green.

## Handoff update

Tick `03`; record the discount-vs-regular rule chosen for "last paid" and add the three fields to
the 00-handoff contract ledger.
