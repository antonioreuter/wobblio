# Sub-spec D — Merchant signal in product search

## Why
When typing a product name in the trends search, show whether one or many stores carry it, so the
user understands the comparison they'll get. Badge = merchant **name** when exactly one store,
**count** ("3 stores") when several — scoped to the active compare mode (own vs market).

## Changes

### Backend — `infrastructure/adapters/data-intelligence/ProductSearchAdapter.ts`
Add four correlated aggregates per product `p`:
- `own_merchant_count` = `count(DISTINCT i.merchant_id)` over `invoice_line l JOIN invoice i ON
  i.id = l.invoice_id WHERE l.product_id = p.id` (RLS-scoped to the caller — tenant context is
  already set on the search transaction).
- `own_merchant_name` = the merchant `brand_name` only when that count = 1, else null.
- `market_merchant_count` = `count(DISTINCT po.merchant_id)` over `price_observation po WHERE
  po.product_id = p.id AND po.quarantined = false` (RLS-exempt global table).
- `market_merchant_name` = the single merchant's `brand_name` when that count = 1, else null.
Keep the existing ACTIVE ∪ own-PROVISIONAL filter and ordering.

### Backend — port/service
- `core/ports/data-intelligence/IProductSearch.ts`: extend `ProductSearchResult` with
  `ownMerchantCount: number`, `ownMerchantName: string | null`, `marketMerchantCount: number`,
  `marketMerchantName: string | null`.
- `ProductSearchService` + `handleProductsRoute`: pass through (no logic change).

### Webapp — `components/workspace/product-search.tsx`
- Extend `ApiProduct` with the four fields; add a `mode: 'own' | 'market'` prop.
- Render `.ta-stores`: pick count/name by mode — count = 1 → show the merchant name; > 1 →
  `"{count} stores"`; 0 → fall back to `brand` (or nothing).
- `app/(app)/reports/page.tsx`: pass the active `mode` (from Sub-spec C) into `<ProductSearch>`.

## Validation
- `cd Source/backend && npm run test:unit` (+ a `ProductSearchAdapter`/service assertion for the
  new fields) + `npx tsc --noEmit`
- `cd Source/backend && npm run validate:security`
- `cd Source/webapp && npx tsc --noEmit && npm run test:unit`

## Deploy (dev only)
`cdk:deploy:backend` (search SQL) + `cdk:deploy:web` (dropdown). DB reset is the user's call.

## Done-when
Search badge shows merchant name (1) / "N stores" (many), tracking the active mode; gates green.
Update `00-handoff.md` (Status D = done — revamp complete).
