# Sub-spec A — Revert the manual size editor (P2c)

## Why
The review-drawer "Set size" control lets a user mutate line data after the pipeline (a
data-poisoning vector) and adds capture effort, breaking the brainless-capture premise. Remove
the whole slice. The P1 amber "size not detected" caveat stays as the unit disclaimer.

## Changes

### Backend
- Delete `Source/backend/src/core/services/ingestion/ConfirmLineSizeService.ts`.
- Delete `Source/backend/src/tests/unit/core/services/ingestion/ConfirmLineSizeService.test.ts`.
- `handlers/api-handler/index.ts`: remove the `PUT /invoices/:id/lines/:lineId/size` route match,
  `handleConfirmLineSize`, and the imports added for it: `ConfirmLineSizeService`,
  `ProductCatalogAdapter`, and the `InvoiceLineNotFoundError`/`InvalidLineSizeError` error imports.
- `core/ports/ingestion/IInvoiceRepository.ts`: remove `LineSizeContext`, `UpdateLineSizeInput`,
  and the `getLineSizeContext`/`updateLineSize` methods. Revert `InvoiceDetailLine` to its
  original 5 fields: `rawText, quantity, unitPrice, lineTotal, categoryName`.
- `infrastructure/adapters/ingestion/InvoiceRepositoryAdapter.ts`: revert `getDetail`'s line
  SELECT + mapping to the original columns; delete `getLineSizeContext`/`updateLineSize` and the
  now-unused `LineSizeContext`/`UpdateLineSizeInput` imports.
- `core/ports/data-intelligence/IProductCatalog.ts` + `ProductCatalogAdapter.ts`: remove
  `setProvisionalPackSize`.
- `core/domain/errors.ts`: remove `InvoiceLineNotFoundError` and `InvalidLineSizeError`.

### Webapp
- `components/workspace/invoice-drawer.tsx`: remove `LineSizeControl`, `applyLineSize`, the
  `Ruler` import, the `UNIT_OPTIONS` const, the eligible-line render block, and revert `DetailLine`
  to its original fields. Restore the original `detail?.lines.map` row rendering.
- `styles/ds/workspace.css`: remove the `.line-size-trigger/.line-size-editor/.line-size-input/
  .line-size-unit/.line-size-save/.line-size-error` rules.

## Keep (do NOT touch)
- P0: `price_observation` nullable columns, `isEmittable` pack-price gate, pack-price serving.
- P1: the `trend-unit-caveat` banner + per-line unit label in `reports/page.tsx`.
- P2a (deposit inference) — that is removed in Sub-spec B, not here.

## Validation
- `cd Source/backend && npm run skill:hexagonal-architecture-validator`
- `cd Source/backend && npm run test:unit` (+ `npx tsc --noEmit`)
- `cd Source/backend && npm run validate:security` (getDetail SQL changed)
- `cd Source/webapp && npx tsc --noEmit && npm run test:unit`

## Done-when
No size-edit control in the invoice drawer; backend has no line-size route/service/ports; all
gates green. Update `00-handoff.md` (Status A = done, What-changed-last, Next = B).
