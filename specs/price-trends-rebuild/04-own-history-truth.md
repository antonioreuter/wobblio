# 04 — Own-history truth

**Layer:** backend (+ webapp types). **Fixes:** B1, B2, B3, F5.
**Contract change:** additive only.

## Problems

### B1 — the size chip can mix two rows

`OwnPurchaseHistoryQueryAdapter.ts:86-87`:

```sql
(array_agg(pack_quantity ORDER BY (pack_quantity IS NOT NULL) DESC, transaction_date DESC))[1] AS pack_quantity,
(array_agg(base_unit    ORDER BY (pack_quantity IS NOT NULL) DESC, transaction_date DESC))[1] AS base_unit,
```

The comment above claims the amount and unit "always come from the same purchase (never a mismatched
pair)". Two independent `array_agg`s with a **non-total** ordering do not guarantee that: on a
`transaction_date` tie between a `2 / L` line and a `500 / KG` line, the two aggregates may resolve
from different rows and produce a chip like "500 L".

### B2 — `purchaseCount` is wrong twice over

`COUNT(*)` over lines inside the 26-week window means:
- bought 5× last year and once last week → `purchaseCount = 1` → the legend claims
  *"First purchase — we'll track this for you"* (`trend-data.ts:48`);
- the same product on two lines of one receipt counts as two purchases.

### B3 / F5 — own lines carry no staleness

`PriceTrendService.decorate()` adds `stale`/`staleDays` to market lines only. `reports/page.tsx:731`
consequently hardcodes `stale: false` for every own series, so a product last bought five months ago
never greys — contradicting §6.5.2 (*"stale cells (no observation in 60 days) are shown greyed with
their age… the UI must never pretend otherwise"*).

## Required behaviour

### Size pick from exactly one row (B1)

Replace the twin `array_agg`s with a `DISTINCT ON` pick over the sized lines:

```sql
size_pick AS (
  SELECT DISTINCT ON (product_id) product_id, pack_quantity, base_unit
  FROM lines
  WHERE pack_quantity IS NOT NULL
  ORDER BY product_id, transaction_date DESC, line_id DESC
)
```

`line_id` makes the ordering total, so the pair is provably from one line. `totals` keeps its
existing `size_source` rule (`bool_or(size_source = 'USER') → 'USER'`, else any size → `'RECEIPT'`,
else `NULL`) and LEFT JOINs `size_pick`.

### Accurate purchase counting (B2)

- `purchaseCount` → `COUNT(DISTINCT invoice_id)`. Semantics change, field name does not — this is the
  bug fix, not a contract break.
- New `priorPurchaseExists: boolean` — does a line for this product exist for this tenant with
  `transaction_date` **before the window start**? Deliberately region- and currency-agnostic: the
  question is *"is this genuinely the first time you bought it"*, not *"in this view"*. RLS still
  scopes it to the caller.

```sql
prior AS (
  SELECT l.product_id, true AS prior_exists
    FROM invoice_line l
    JOIN invoice i ON i.id = l.invoice_id
   WHERE l.product_id = ANY($1::uuid[])
     AND i.status IN ('PARSED', 'NEEDS_REVIEW')
     AND i.transaction_date IS NOT NULL
     AND i.transaction_date < CURRENT_DATE - ($2::int * 7)
   GROUP BY l.product_id
)
```

### Own-history staleness (B3)

`PriceTrendService` decorates own lines the same way it decorates market lines, reusing the existing
`daysSince()` helper and `TREND_STALE_DAYS`:

```ts
export interface ServedOwnPurchaseLine extends OwnPurchaseLine {
  stale: boolean
  staleDays: number
}
```

`PriceTrendComparison.ownHistory` becomes `ServedOwnPurchaseLine[]`.

### Port changes

`IOwnPurchaseHistoryQuery.OwnPurchaseLine` gains `priorPurchaseExists: boolean`. Comments on
`purchaseCount` are corrected to say *distinct invoices in the window*.

### Webapp consumption

- `use-price-trends.ts` — `OwnPurchaseLine` gains `stale`, `staleDays`, `priorPurchaseExists`.
- `trend-chart-model.ts` — own series carry the real `stale`/`staleDays` instead of `false`/`0` (F5).
- `trend-data.ts` — `personalHistory()` treats `priorPurchaseExists === true` as disqualifying the
  `first` verdict:

```ts
if (!input.priorPurchaseExists && input.purchaseCount <= 1) return { kind: 'first' }
```

## Not doing

- No DDL. Every change is read-only SQL.
- No change to the location predicate, the currency filter, the `PARSED | NEEDS_REVIEW` status
  allowlist, the deposit/fee exclusion, or the `lastPrice`/`previousPrice` ranking rule.
- No per-unit maths anywhere (fix 09 DEC-1).

## Files

- **Modified:** `Source/backend/src/infrastructure/adapters/data-intelligence/OwnPurchaseHistoryQueryAdapter.ts`,
  `src/core/services/data-intelligence/PriceTrendService.ts`,
  `src/core/ports/data-intelligence/IOwnPurchaseHistoryQuery.ts`
- **Modified (webapp):** `src/components/workspace/use-price-trends.ts`, `trend-data.ts`,
  `trend-chart-model.ts`

## Done when

- `skill:hexagonal-architecture-validator` exit 0.
- `npm run test:unit` green **with coverage still at lines 99 / functions 100 / branches 99** over
  `src/core/**`.
- `npm run validate:security` green (adapter SQL changed).
- `npm run test:integration` green, including the new cases from sub-spec 06.
