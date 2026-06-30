# 16e — Review & Correction (non-deferred edits)

**Mobile epic | Parent: [16](../16-mobile-capture-and-review.md) · Tracker: [16-00](./16-00-handoff.md)**

The on-device review screen: a split zoomable-photo / scrollable-fields layout where the user fixes
date, total, and line items, then confirms — flipping the invoice to `PARSED` and triggering the
trust/alias + price-observation repair downstream. **Merchant tap-to-fix and the add-tag picker are
deferred to 16h** (they need backend endpoints that don't exist yet).

## Dependencies
- [16d](./16d-mobile-dashboard-feedback.md) (entered from a `Needs review` pill or thumbs-down shortcut)
- [07](../07-core-ingestion-pipeline.md) (status machine, confirm/correct) · [08](../08-data-intelligence-layer.md) (`/products/search`)

## Layout
- Vertically split: **pinch-to-zoom receipt photo (top)**, **scrollable parsed fields (bottom)**.
  Mirror the webapp `receipt-viewer.tsx` zoom/pan and `invoice-drawer.tsx` field layout.
- Low-confidence (`LOW_CONFIDENCE`) fields pre-highlighted **amber**.

## Tap-to-fix (this slice)
- **Date** → date picker.
- **Total** → numeric input.
- **Line item** → bottom sheet: **product search-as-you-type via existing `/products/search`**,
  size/unit edit, price edit.
- **Confirm** (single sticky button): saves corrections, flips status to `PARSED`, triggers
  trust/alias updates and `quality=USER_CONFIRMED` price-observation repair (server-side).
- **Discard** for `SUSPECTED_DUPLICATE`: no price observation, quota refunded.

## Explicitly deferred to 16h
- **Merchant tap-to-fix** (needs `/merchants/search` → writes `USER_CONFIRMED` alias).
- **Add-tag picker** over the fixed vocabulary §6.10.4 (needs the tag-vocabulary endpoint). Existing
  tags render as **read-only chips** in this slice; removal of existing chips MAY ship here if the
  confirm/correct payload already supports tag removal — otherwise defer with the picker.

## Reuse references
- `Source/webapp/src/components/workspace/{invoice-drawer.tsx,receipt-viewer.tsx}` (layout, zoom,
  field editing, confirm/discard semantics).
- `Source/backend/.../products/search` contract for the line-item product search.
- Verify the exact correction/confirm endpoint + payload against `api-handler/index.ts` and the
  `ConfirmService` before wiring (the webapp drawer is the behavioral reference).

## Backend built for this slice (none existed before)
- **`PUT /invoices/{id}`** (`CorrectInvoiceService` + `IInvoiceRepository.applyCorrection`): persists
  edited date/total + per-line `productId`/quantity/unitPrice/lineTotal, flips `NEEDS_REVIEW|PARSED →
  PARSED`, stamps `invoice.corrected_at` (new migration), resets corrected lines' `confidence` to 1.
  409 if not correctable, 400 on invalid payload, 404 cross-tenant (RLS).
- **`GET /invoices/{id}`** now returns per-line `id`, `productId`, and `confidence` (for amber + edit).
- **USER_CONFIRMED price repair:** `corrected_at` flows through `getForReEmission → userCorrected →
  buildPriceObservations` so a corrected invoice's observations emit `quality='USER_CONFIRMED'` at the
  **existing location-confirm gate** (`InvoiceLocationService`/`HeldInvoiceReleaseService`).
  **Invariant #2 boundary:** the Price Observation Store keeps no invoice reference, so already-emitted
  `AUTO` rows cannot be retroactively rewritten — "repair" means corrected lines emit `USER_CONFIRMED`
  at emission time, not a post-hoc row update. See memory `mobile-16e-correction-pipeline`.

## Checklist
- [x] Split layout: pinch-to-zoom image (top, `InteractiveViewer`), scrollable fields (bottom)
- [x] Amber highlight on low-confidence lines (`confidence < 0.7`). *Date/total have no per-field
      confidence in the backend (only `invoice_line.confidence`), so amber is line-level.*
- [x] Date tap-to-fix (`showDatePicker`) + Total tap-to-fix (numeric dialog)
- [x] Line-item bottom sheet: `/products/search` as-you-type, quantity/unit-price/line-total edit
- [x] Confirm: saves corrections, flips to `PARSED`, drives `USER_CONFIRMED` price emission (above)
- [x] Discard for `SUSPECTED_DUPLICATE` via existing `DELETE`. *No quota refund: the credit model
      charges on successful processing and the refund path was decommissioned (memory
      `system-fault-quarantine-03-core`); discard removes the receipt + S3 object + ledger claim.*
- [x] Merchant tap-to-fix + add-tag picker **deferred to 16h** (no `/merchants/search` or tag-vocab
      endpoint). Existing tags are not edited here.
- [x] `ReviewBloc` unit tests (mocked ports); `flutter analyze` clean — `review_bloc_test.dart`
      (load/fail, edit+confirm payload, confirm/discard success+failure, product-search min-length).
      Backend: `CorrectInvoiceService.test.ts` + `buildPriceObservations` quality test; `test:unit`
      760 green (99.01% branch), hexagonal + `tsc` + `validate:security` clean.

## Verification
- [x] Unit: editing date/total/a line then Confirm posts the merged payload; a corrected invoice
      builds `USER_CONFIRMED` observations.
- [ ] **Pending on-device:** Confirm flips the dev invoice to `PARSED`; `/products/search` returns
      matches in the sheet; discarding a `SUSPECTED_DUPLICATE` removes it. A clean receipt confirms in
      one tap.
