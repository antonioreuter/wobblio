# 05 — Legend honesty and diagnostics

**Layer:** webapp. **Fixes:** F5 (render half), F6, F7. **Depends on:** 01, 04.
**Contract change:** none.

## Problems

### F6 — the legend silently swaps metrics

`reports/page.tsx:617`:

```ts
const headline = own ? s.lastPrice ?? rangeMedian : rangeMedian
```

In own mode the headline is labelled **"last paid"**. When `lastPrice` is null the code silently
substitutes the *median of the visible range* — a different metric with the same label. Two
quantities, one caption, no disclosure.

### F5 — own series never grey

Now that 04 serves `stale`/`staleDays` for own history, the legend must actually show it. Today the
own branch renders only "last bought {date}".

### F7 — silently vanishing products

`diagnosticNote()` (`page.tsx:454-458`) explains only backend reasons (`NO_PURCHASES_IN_REGION`,
`BELOW_QUORUM`, `OUT_OF_WINDOW`, `CURRENCY_MISMATCH`, `PREMIUM_REQUIRED`). A product whose data
exists but falls outside the **selected date range** gets no note at all — with two products
selected and one out of range, the second simply disappears from chart and legend.

## Required behaviour

### Honest headline

- Own mode: show `formatViewMoney(s.lastPrice)` when present, otherwise `—`. No fallback to the range
  median. The existing "last bought {date}" caption already discloses that `lastPrice` is
  window-wide rather than range-scoped — keep it.
- Market mode: unchanged (range median plus the delta labelled **"over range"**).

### Stale badge on own series

Own series render the same `stale · Nd` badge market series use, driven by the fields added in 04.
Glyph + text, never colour alone.

### Merged chip diagnostics

The product chip note merges two sources, backend first:

1. `comparison.diagnostics[]` — the server-side reason (unchanged strings).
2. `TrendChartModel.hidden[]` from sub-spec 01 — the client-side reason:
   - `OUT_OF_RANGE` → `outside this date range`
   - `NO_DATA` → falls through to the backend note (the server already explains it)

Keep `data-testid="trend-chip-note"` and the existing `title="Why this isn't charting"`.

### Copy that must not change

`specs/price-trends-gaps/03-personal-history-messaging.md` and §6.5.5 mandate:

- `last paid {money}` + `{▲/▼ N%} vs previous scan` — up = danger, down = success, **always** glyph
  plus text label, never colour alone.
- `First purchase — we'll track this for you` for a genuinely first purchase (now accurate thanks to
  `priorPurchaseExists`).
- The market delta is explicitly labelled `over range`.

The `priceOnly` verdict from `personalHistory()` (≥2 purchases but no comparable previous regular
scan) renders the price with no delta and no first-purchase copy — unchanged, and correct.

### Help modal

`price-trends-help.tsx` gains one point explaining the new convention:

> **Gaps in the line** — a dotted stretch means we have no price for those weeks. Solid means
> consecutive weeks; a dot marks every week we do have.

## Files

- **Modified:** `Source/webapp/src/app/(app)/reports/page.tsx`,
  `src/components/workspace/trend-chart-model.ts`, `src/components/workspace/price-trends-help.tsx`

## Done when

- A product with no `lastPrice` shows `—`, never a range median labelled "last paid".
- An own series last bought >60 days ago shows `stale · Nd` and greys.
- Selecting two products where one is outside the range shows `outside this date range` on that
  product's chip.
- `npm run lint` and `npm run test:unit` green.
