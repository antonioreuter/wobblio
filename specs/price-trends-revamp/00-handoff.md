# Price-Trends Revamp — Handoff / Context Carry-Over

> Living doc. Update the **Status** + **What changed last** + **Next** sections at the END of
> each sub-spec so a fresh context window can resume without losing state.

## Goal
Revert the P2 size features that proved problematic, then improve the trends page. Keep the
P0 pack-price design and the P1 "size not detected" caveat (the unit disclaimer).

## Locked decisions
- **Remove ALL size inference**: the manual "Set size" editor (P2c) AND the deposit→size table
  (P2a). Keep only the pre-existing printed-line + LLM/catalog size in `ProductNormalizer`.
- Own purchase history stays **one blended line per product** (not per merchant).
- Product-search badge: merchant **name** when exactly 1 store carries it; **count** ("3 stores")
  when several.
- Trends **compare-mode toggle** `My prices | Local market`. Market is **Premium-only** — STANDARD
  users see only their own prices (+ the existing upsell). Default mode = `My prices` (own).
- Search merchant count **follows the active compare mode** (API returns both own + market counts).

## Status
- [x] A — revert manual size editor (P2c) — done 2026-06-27, deployed dev (backend+web)
- [x] B — remove deposit inference (P2a) — done 2026-06-27, deployed dev (table dropped, backend+web)
- [x] C — compare-mode toggle — done 2026-06-27 (frontend only; C+D NOT yet deployed)
- [x] D — search merchant signal — done 2026-06-27 (backend SQL + web; NOT yet deployed)

**REVAMP COMPLETE** (A–D). C+D awaiting `cdk:deploy:backend` + `cdk:deploy:web` to dev.

Order: A → B → C → D. Each is independently shippable; D's frontend badge uses the `mode` from C.

## What changed last (D — merchant signal in product search)
- `ProductSearchAdapter.ts`: two `LEFT JOIN LATERAL` aggregates — `own` (DISTINCT
  `invoice.merchant_id` via RLS-scoped invoice_line/invoice/merchant) and `mkt` (DISTINCT
  `price_observation.merchant_id` where `quarantined = false`, RLS-exempt). Each returns
  `merchant_count` + `brand_name` (the latter surfaced only when count = 1). Existing
  ACTIVE ∪ own-PROVISIONAL filter + ordering unchanged.
- `IProductSearch.ProductSearchResult`: +`ownMerchantCount/ownMerchantName/marketMerchantCount/
  marketMerchantName`. Service + handler are pure pass-through (no logic change).
- Webapp `product-search.tsx`: `ApiProduct` gains the four fields; new `mode` prop; `storeSignal()`
  picks count/name by mode (1 → name; >1 → "N stores"; 0 → brand fallback). `reports/page.tsx`
  passes `mode` into `<ProductSearch>`.
- Tests: `ProductSearchService.test.ts` literal updated + pass-through assertion. No adapter test
  (SQL — covered at integration tier; none existed).
- Gates: backend tsc ✓, hexagonal ✓, 613 unit ✓, validate:security ✓; webapp tsc ✓, 107 ✓.
- No DB migration (read-only SQL). NOT deployed yet.

## What changed last (C — compare-mode toggle)
- `reports/page.tsx`: added `CompareMode = 'own' | 'market'` + `mode` state (default `'own'`).
  Segmented control `[ My prices | Local market ]` in the chart panel-header (`.trend-mode-toggle`);
  `Local market` disabled w/ Lock icon for STANDARD (stays on `own`, upsell card already shown),
  PREMIUM/TESTER/ADMIN switch freely. testids `trends-mode-own` / `trends-mode-market`.
- `buildChart` now takes `mode`: emits ONLY the active source (own → `ownHistory`; market →
  `comparison.lines`), week axis built from that source only. `unitWarning`/caveat preserved.
- `TrendChartBody` takes `mode`: empty copy is mode-aware (market → "needs 3 confirmed scans
  nearby"; own → "once you've scanned…"; range-hides-all → "widen the range").
- CSS `.trend-mode-row` / `.trend-mode-toggle` / `.trend-mode-btn` in `styles/ds/workspace.css`.
- `mode` is in `ReportsPage` scope where `<ProductSearch>` is rendered → ready to pass as a prop in D.
- Gates: webapp tsc ✓, 107 tests ✓. No API/DDL change (frontend only). NOT deployed yet.

## What changed last (A + B, the revert pair)
- Deleted `ConfirmLineSizeService.ts` (+ test); removed `PUT /invoices/:id/lines/:lineId/size`
  route/handler + imports from `api-handler/index.ts`.
- Reverted `InvoiceDetailLine`/`getDetail` to original columns; removed `getLineSizeContext`/
  `updateLineSize` from `IInvoiceRepository` + adapter; removed `setProvisionalPackSize` from
  `IProductCatalog`/`ProductCatalogAdapter`; removed `InvoiceLineNotFoundError`/`InvalidLineSizeError`.
- Webapp `invoice-drawer.tsx`: removed `LineSizeControl`/`applyLineSize`/`Ruler`/render block;
  reverted `DetailLine`; removed `.line-size-*` CSS.
- Deleted `containerDeposit.ts`, `IContainerDepositReference.ts`, `ContainerDepositReferenceAdapter.ts`,
  `containerDeposit.test.ts`; reverted `ProductNormalizer.ts` (no deposit arg; printed→catalog
  precedence) + its test + worker wiring.
- Migration `20260627140000_drop_container_deposit_rule` applied to dev; removed from reset PRESERVE.
- Gates green: hexagonal ✓, backend 612 tests / branches 99.12% ✓, validate:security ✓, cdk synth ✓,
  webapp tsc + 107 tests ✓. Deployed `WobblioBackendStack-dev` + `WobblioWebStack-dev`.

## Next
All sub-specs (A–D) implemented. **Remaining: deploy C+D to dev** —
`cd Source/infra && STAGE=dev npm run cdk:deploy:backend && STAGE=dev npm run cdk:deploy:web`.
Then manual QA: mode toggle filters series + premium gating (C); search badge shows name (1
store) / "N stores" (many) tracking the active mode (D). No DB migration needed.

## Environment cheat-sheet
- Dev DB: host `shared-rds-pg15.cz2iqizs0pdr.eu-west-1.rds.amazonaws.com:5432`, db `wobblio_dev`,
  secret `shared/db/wobblio_dev` (user `wobblio_dev_app`). `DATABASE_URL` needs
  `?uselibpqcompat=true&sslmode=require`. psql via `PGPASSWORD=… psql -h … -U wobblio_dev_app -d wobblio_dev`.
- `wobblio` (no `_dev`) = **PROD — never touch** (NON-NEGOTIABLE).
- Migrate: `cd Source/infra && DATABASE_URL=… npm run migrate:up`.
- Deploy dev: `cd Source/infra && STAGE=dev npm run cdk:deploy:backend` / `cdk:deploy:web`.
- **DB reset (truncate+reseed) is USER-RUN ONLY** — the auto-mode classifier blocks the agent.
  Command: `DATABASE_URL=… STAGE=dev CONFIRM_RESET=wobblio_dev npm run reset:dev` (Source/infra).

## Gotchas
- `rg` and `grep` are wrapped by a hook and return garbled output via Bash — use `command grep`
  or a small `python3` script for code search.
- `price_observation` has NO line/tenant linkage (de-identified) — can't retro-correct rows.
- Own-history is blended by product (one line/product); per-merchant is the market trend only.
- Validation gates per sub-spec: `npm run skill:hexagonal-architecture-validator`, `npm run
  test:unit` (backend + webapp), `npm run validate:security` (DDL/adapter changes), `cdk synth`.
