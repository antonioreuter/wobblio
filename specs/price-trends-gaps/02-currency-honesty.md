# 02 — Currency honesty (G2 + M2)

## Problem

The report renders every price in euros regardless of the receipt's actual currency, and never
filters observations by currency:

- **Market SQL** (`PriceTrendQueryAdapter.ts:37–88`) selects `pack_price` / `normalized_unit_price`
  but never reads or filters `price_observation.currency` (a `CHAR(3) NOT NULL` column). If a
  region's observations span currencies, medians blend them.
- **Own SQL** (`OwnPurchaseHistoryQueryAdapter.ts:34–93`) never filters `invoice.currency`, and
  deliberately includes pending-location receipts whose `location_country_code IS NULL`. Such a
  receipt can be in a foreign currency yet gets blended into *any* picker view's medians.
- **Webapp** hardcodes the symbol: `€${now.toFixed(2)}` (`reports/page.tsx:368`) and `unitLabel()`
  returns `€/L`, `€/kg`, `€/pc` (`reports/page.tsx:46–51`); the chart axis/tooltip in
  `line-chart.tsx` render `€` too.

This violates the country-agnostic standing rule — the user operates across 13 countries — and
produces silently wrong numbers for any non-EUR receipt.

Scope is **honesty, not conversion**: each view is filtered to a single currency and rendered with
the right symbol. No FX harmonization (that stays deferred per §11 — the report shows the shelf
price the user actually paid).

## Required behaviour

### Expected currency for a view
The picker is country + region. Derive the **expected ISO-4217 currency from the country**:

- Add a small curated constant map in `Source/backend/src/core/domain/` (e.g.
  `currencyByCountry.ts`: `countryCurrency(iso2): string | null`). Data-minimal — cover the
  operating countries (NL/EUR launch market plus the others the user transacts in); return `null`
  for unknown countries. This is a domain constant, not a DB table (no DDL, no migration).
- Rationale for country-derived (not caller `home_currency`): the report is about *a region's*
  prices; the honest unit is the currency actually charged there, independent of who is viewing.

### Backend — market query
- Filter observations to the expected currency: `AND po.currency = $<n>` in the `obs` CTE.
- If the country has no mapping (`null`), fall back to **the modal currency of the matched
  observations** (most frequent `currency` among the region's rows) so the view stays single-currency
  and never blends. Surface which currency was used.

### Backend — own query
- Apply the same currency filter on the invoice: `AND i.currency = $<n>` (expected currency for the
  picker country). This closes the pending-location foreign-receipt leak while **keeping** the
  existing pending-location inclusion behaviour for same-currency receipts (the deliberate prior fix
  — a receipt still in location review but in the right currency should still chart).
- Note: `invoice.currency` is `NULL` until parsed; a `NULL` currency row must not match the filter
  (it won't, with `=`), which is correct — unparsed invoices have no trustworthy price yet.

### Ports / service / API
- Add `currency: string` to the response (`PriceTrendComparison` in `PriceTrendService.ts:16–22`
  and the mirrored `TrendComparison` in `use-price-trends.ts:36–42`). The whole view is
  single-currency, so **one top-level field** is sufficient — do not add per-line currency.
- The service resolves the expected/modal currency once and stamps it on the response. Keep role
  policy in the handler unchanged.

### Webapp — reuse existing helpers, do not add a new one
The codebase already has currency formatting (AHA / Rule-of-Three — do not invent a parallel helper):
- **`formatMoney(amount, { currency })`** in `Source/webapp/src/lib/currency.ts` — Intl-based,
  ISO-4217 aware, produces the correct symbol/format (nl-NL locale). Use it for full amounts: the
  legend "now" value (replacing `€${now.toFixed(2)}` at `reports/page.tsx:368`) and the
  `line-chart.tsx` tooltip.
- **`CURRENCY_SYMBOLS`** map in `Source/webapp/src/components/workspace/invoice-data.ts:78` — for the
  bare-symbol cases where a full amount is wrong, i.e. `unitLabel()` (`<sym>/kg`, `<sym>/L`,
  `<sym>/pc` at `reports/page.tsx:46–51`) and the chart Y-axis tick labels in `line-chart.tsx`.
  Extend the map if an operating-country symbol is missing; keep the ISO-code fallback for unknowns.
- Thread `comparison.currency` down to the legend and chart. When no comparison yet, no symbol shown.
- (`@/lib/currency` also exports `formatDelta` — reused by sub-spec 03 for the legend delta.)

### M2 — stale comment
Fix the comment in `OwnPurchaseHistoryQueryAdapter.ts:27`: it claims "lines without a normalized
unit price are excluded", but the SQL falls back to pack price (`CASE WHEN unit_known …`). Correct
the comment to describe the pack-price fallback.

## Files to touch

- `Source/backend/src/core/domain/currencyByCountry.ts` (new — constant map + `countryCurrency`)
- `Source/backend/src/core/services/data-intelligence/PriceTrendService.ts` (resolve + stamp currency)
- `Source/backend/src/core/ports/data-intelligence/IPriceTrendQuery.ts` &
  `IOwnPurchaseHistoryQuery.ts` (input gains `currency`; or service passes it into the query inputs)
- `Source/backend/src/infrastructure/adapters/data-intelligence/PriceTrendQueryAdapter.ts` (filter + modal fallback)
- `Source/backend/src/infrastructure/adapters/data-intelligence/OwnPurchaseHistoryQueryAdapter.ts` (filter + M2 comment)
- `Source/webapp/src/components/workspace/use-price-trends.ts` (`currency` on `TrendComparison`)
- `Source/webapp/src/app/(app)/reports/page.tsx` (`unitLabel` + legend → `formatMoney`/`CURRENCY_SYMBOLS`)
- `Source/webapp/src/components/workspace/line-chart.tsx` (axis + tooltip symbol via the same helpers)
- `Source/webapp/src/components/workspace/invoice-data.ts` (extend `CURRENCY_SYMBOLS` only if a needed symbol is missing)

**No DDL / migration** — `currency` already exists on both `price_observation` and `invoice`.

## Tests

- **Integration** (`PriceTrendQuery.local.test.ts` sibling): seed a product with observations in two
  currencies in the same region → only the expected-currency rows feed the medians; the other
  currency is excluded. Repeat for own-history with a foreign-currency pending-location invoice →
  excluded.
- **Unit**: `countryCurrency` returns the right ISO for operating countries and `null` for unknown;
  `PriceTrendService` stamps the resolved currency and passes it to both queries.
- **Webapp unit**: `currencySymbol` mapping + fallback; legend/`unitLabel` render the response
  currency, not a hardcoded `€`.

## Definition of Done

- [ ] A GBP region charts in `£`; a EUR region in `€`; unknown-country falls back to modal currency + ISO label.
- [ ] Mixed-currency observations no longer blend into one median (integration test proves exclusion).
- [ ] Pending-location foreign-currency own receipts excluded; same-currency pending receipts still included.
- [ ] `currency` present on the response; `use-price-trends.ts` type updated; noted in the 00-handoff contract ledger.
- [ ] M2 comment corrected.
- [ ] `skill:hexagonal-architecture-validator` exit 0; backend + webapp `test:unit` green; `validate:security` green (adapter SQL changed).

## Handoff update

Tick `02`; record which countries the constant map covers and the modal-fallback behaviour, and
confirm the `currency` field is in the contract ledger for mobile 18e.
