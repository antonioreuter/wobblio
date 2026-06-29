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

## Checklist
- [ ] Split layout: pinch-to-zoom image (top), scrollable fields (bottom)
- [ ] Amber highlight on `LOW_CONFIDENCE` fields
- [ ] Date tap-to-fix (picker) + Total tap-to-fix (numeric)
- [ ] Line-item bottom sheet: `/products/search`, size/unit edit, price edit
- [ ] Confirm: saves corrections, flips to `PARSED`, triggers trust/alias + price repair
- [ ] Discard for `SUSPECTED_DUPLICATE` (quota refunded)
- [ ] Merchant tap-to-fix + add-tag picker **deferred to 16h** (documented in-screen)
- [ ] `ReviewBloc` unit tests (mocked ports); `flutter analyze` clean

## Verification
- Editing date/total/a line item and tapping Confirm flips the invoice to `PARSED` server-side.
- Line-item product search returns matches from `/products/search`.
- Discarding a `SUSPECTED_DUPLICATE` refunds quota (`/me/usage` reflects it) and emits no price obs.
- A clean receipt confirms in one tap; a messy one in under ~30s.
