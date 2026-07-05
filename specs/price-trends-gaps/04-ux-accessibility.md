# 04 — UX & accessibility: data-table toggle + live cold-start count (G4 + G5)

## Problem

**G4 — no chart↔table toggle.** The webapp design brief is unambiguous: *"Every chart paired with a
data-table toggle"* and *"Full keyboard navigation on tables"* (`Source/webapp/CLAUDE.md`, Layout →
Responsive floor). The price-trends chart (`line-chart.tsx`) is an SVG whose only affordance is a
mouse-hover crosshair — no keyboard access to the underlying numbers, no screen-reader path, no way
to read exact values on a touch device. This is the flagship premium report; it is the one that most
needs the table.

**G5 — cold-start motivator is static.** The spec's contribution motivator is a *live* count:
*"2 stores tracked in your area — scan more receipts to unlock comparisons"* (§6.5.5). The market
empty state (`reports/page.tsx:321–323`) uses fixed copy — "comparison needs at least 3 confirmed
scans nearby" — with no store count, so it can't show the "you're close" nudge that turns a locked
chart into a reason to scan. The count already exists elsewhere: `ProductSearchAdapter` computes
`marketMerchantCount` per product (see `specs/price-trends-revamp/04-*`).

## Required behaviour

### G4 — data-table toggle
- Add a `Chart | Table` segmented control to the chart panel header (mirror the existing
  `.trend-mode-toggle` pattern used for My prices / Local market — same component, same keyboard
  semantics, `role="group"`, `aria-pressed`).
- **Table view** renders the *same visible series* the chart shows:
  - Rows = weeks (the shared week axis / `labels`), most recent first or chronological — pick one and
    be consistent with the chart's x-axis direction.
  - Columns = one per visible series (`product · merchant` in market mode, `product · Your purchases`
    in own mode).
  - Cells = the weekly median, **right-aligned, `font-variant-numeric: tabular-nums`**, in the view
    currency symbol (from sub-spec 02). Empty weeks render `—` (never interpolated).
  - Discount values shown distinctly (e.g. a promo tag/second value in the cell), matching the
    chart's diamond markers — do not blend.
  - Stale series columns carry the same "stale · Nd" flag the legend uses.
  - Reuse the existing `ds` table primitives (sticky header, right-aligned numerics) — do not build a
    snowflake table.
- Full keyboard navigation + WCAG AA contrast in both themes. The toggle is keyboard-operable; the
  table is reachable and readable without a mouse.

### G5 — live cold-start count
- When market mode has **no cleared cells** but the region *does* have some tracked stores
  (`0 < stores < k`), the empty state reads:
  **"{N} store{s} tracked in your area — scan more receipts to unlock comparisons."**
  When zero stores are tracked, keep the plain "No local-store prices yet — every scan makes it
  smarter." variant.
- **Source of N (pick the simplest honest one):**
  - Preferred: extend the trends response with a per-product `regionMerchantCount` (distinct
    non-quarantined `price_observation.merchant_id` for the product in the picker region — the count
    *before* the k≥3 gate). This is honest and self-contained in the report. Small additive change to
    `PriceTrendQueryAdapter` (a pre-gate count) surfaced on the response, gated so it's still computed
    for the empty case even when no cell clears k≥3.
  - Alternative: reuse the `marketMerchantCount` already returned by product search
    (`ProductSearch` results) and thread it into the page state. Cheaper, but couples the empty state
    to the search widget's data. Choose the response-field approach unless it proves disproportionate.
- Keep the "every scan makes it smarter" honesty tone (webapp hard rule #4). Never hide the
  not-yet-available state.

## Files to touch

- `Source/webapp/src/app/(app)/reports/page.tsx` (Chart|Table toggle state; table render; dynamic empty copy)
- `Source/webapp/src/components/workspace/` — a new `trend-table.tsx` (or inline if small), reusing `ds` table
- `Source/webapp/src/components/workspace/use-price-trends.ts` (+ `regionMerchantCount` on the type, if chosen)
- `Source/webapp/src/styles/ds/workspace.css` (toggle + table styles, matching `.trend-mode-*`)
- If `regionMerchantCount` route chosen: `PriceTrendQueryAdapter.ts`, `IPriceTrendQuery.ts`,
  `PriceTrendService.ts` (pre-gate count, additive response field)

**No DDL / migration.** Frontend-heavy; the optional count is a read-only SQL addition.

## Tests

- **Webapp unit**: toggle switches chart↔table; table renders the same series/weeks the chart does,
  with `—` for gaps, tabular-nums, correct currency symbol, stale flag; keyboard operability of the toggle.
- If `regionMerchantCount` added: **integration** — a region with 2 tracked stores (below k) returns
  `regionMerchantCount = 2` and the empty state shows "2 stores tracked in your area…"; **unit** for
  the service pass-through.

## Definition of Done

- [ ] Chart|Table toggle present; table shows identical visible data, right-aligned tabular-nums, per-view currency, discount + stale honesty preserved.
- [ ] Table + toggle fully keyboard-navigable; WCAG AA both themes; usable at 768px.
- [ ] Cold-start empty state shows the live store count when `0 < stores < k`, plain copy at zero.
- [ ] Source of the count decided and documented; contract ledger updated if a response field was added.
- [ ] Webapp `test:unit` green (+ backend gates if the count route was chosen).

## Handoff update

Tick `04`; record the count-source decision and, if a response field was added, append it to the
00-handoff contract ledger.
