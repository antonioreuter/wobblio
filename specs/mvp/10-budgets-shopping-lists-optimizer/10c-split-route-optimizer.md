# 10c — Split-Route Optimizer

**Epic 8 | Phase 4 | Premium feature**

## Overview

Premium feature. Input: a [shopping list](./10b-shopping-lists.md) with product-resolved items. Evaluates the list and groups items into up to `max_stores` (default 3) supermarkets, showing which store to buy what and the expected saving. Users can remove a proposed store from the result; its items reallocate to the next-cheapest remaining candidate store (or fall back to the primary store if none has a real observation for that product).

## Dependencies

- [10b — Shopping Lists](./10b-shopping-lists.md) (source of items, category, region override)
- [08 — Data Intelligence Layer](../08-data-intelligence-layer.md) (`price_observation` matrix, §6.5.3)

## Algorithm

1. Build price matrix: `product × candidate_merchants` (merchants with sufficient regional data — k≥3 observations — in the list's effective region)
2. If the user has removed one or more stores from a previous result in this session, drop those merchants from the candidate set **before** the algorithm runs — the baseline and per-product cheapest-store computation below then naturally pick the next-best remaining store for every affected item. No separate reallocation step; it falls out of re-running the same algorithm over a smaller merchant set.
3. Compute single-best-store baseline: minimum over merchants of Σ (best-known unit price × quantity); missing cells filled with the user's historical average for that product
4. Compute unconstrained minimum: Σ per-product minima (unit price × quantity)
5. If `unconstrained_min` saves more than SSM threshold (`/wobblio/config/routing/min_split_saving`, default €5.00) vs. baseline:
   - Partition greedily into ≤`max_stores` (default 3) sub-lists
   - Merge any sub-list with marginal saving < €1.50 into the main store
6. Output: per-store sub-lists with expected unit price, quantity, line total, total expected saving, per-line confidence (observation count + age)

Free-text items that match no product → excluded from optimization, assigned to primary store.

## Effective Region

Resolved as `list.region_code ?? list.country_code ?? contributor.region_code ?? contributor.country_code` — the list's Premium override (if set, see [10b](./10b-shopping-lists.md)) wins; otherwise falls back to the shopper's own profile, same as before this refactor.

## Store Removal & Reallocation

- The optimizer result is re-run on demand (manual trigger), not continuously.
- Removing a proposed store from a result is a one-off, session-local action — it recomputes the result with that merchant excluded from the candidate set, but nothing is persisted server-side. Reopening the list (or re-running from scratch) starts fresh with every regional candidate store eligible again.
- Multiple removals in the same session accumulate (removing store A, then store B, both stay excluded until the session ends).
- If an item has no cell at any remaining candidate store, it falls back to the (recomputed) primary/baseline store — same honest-fallback behavior the algorithm already has for products with only a user-average price, no new failure mode introduced.

## Output UI

Mobile:
- `Optimize route` button (Premium) on list detail screen
- Results: store-grouped sections with savings headline ("Save €7.40 across 2 stores")
- Per-line: quantity × expected unit price = line total, plus confidence indicator
- Store chips with a remove (×) action per store, mirroring the bill-split "People" chip pattern

Web:
- Same on Shopping Lists page — store chip row above the grouped result, `PREMIUM` pill badge, "€X grouped across N stores" progress microcopy
- Optional: print/export sub-lists

---

## Checklist

### Split-Route Optimizer
- [x] `POST /lists/{id}/optimize` — trigger optimization (PREMIUM only)
- [x] Price matrix construction: query `price_observation` for product × merchant within the list's effective region
- [x] Single-best-store baseline computation
- [x] Unconstrained minimum computation
- [x] Greedy partition into ≤`max_stores` sub-lists (€1.50 marginal saving threshold)
- [x] Free-text (unresolved) items assigned to primary store
- [x] Response: per-store sub-lists, expected prices, total saving, per-line confidence
- [x] SSM threshold read: `min_split_saving`, `max_stores`
- [ ] Quantity-weighted baseline/assignment/saving math (all totals × `quantity`, not unit price alone)
- [ ] `excludedMerchantIds` request param — filters the candidate merchant set before the algorithm runs (reallocation)
- [ ] Effective-region resolution honors the list's Premium override before falling back to profile region

### Optimizer UI (Mobile)
- [ ] `Optimize route` button on list detail (premium-gated) — deferred to Epic 16 mobile build
- [ ] Store-grouped result view with savings headline
- [ ] Per-line confidence indicator (observation count + age)
- [ ] Store chip row with remove action

### Optimizer UI (Web)
- [x] `Optimize route` action on Shopping Lists page
- [x] Store-grouped result view (store-grouped, savings headline)
- [ ] `PREMIUM` pill badge + "€X grouped across N stores" progress microcopy
- [ ] Store chip row (avatar-style, × to remove) driving `excludedMerchantIds` re-optimize
- [ ] Per-line quantity × unit price = line total display
- [ ] Print/copy actions
