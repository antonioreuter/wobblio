# 07c — Web Review-Correction Parity

**Parent:** [07 — Core Ingestion Pipeline](../07-core-ingestion-pipeline.md) · **Priority: P3
(user-facing capability promised for web since Phase 3; mobile now leapfrogs web on web's own
launch surface)** · **Tag:** [GAP] (surface parity) · **DB migration:** none.

## Gap

Spec `07:93-99` + checklist `07:156-161` promise the web review drawer "correction capabilities:
merchant/date/total tap-to-fix, line-item edit". The correction backend **never existed in 07/08**;
it was built full-stack by mobile slice **16e** (2026-06-30): `PUT /invoices/{id}` →
`CorrectInvoiceService` + `IInvoiceRepository.applyCorrection` + `corrected_at`, with corrected
invoices emitting `USER_CONFIRMED` price observations at the location-confirm gate.

The webapp never caught up: `Source/webapp/src/app/api/invoices/` contains no correction BFF route
(only `[id]/location`), and the drawer has no edit affordances. So today: mobile users can fix a
misparsed date/total/line and upgrade observation quality; web users — the only users during the
web-first launch — cannot.

## Proposed fix

Web-only; the backend contract is done and proven by the Flutter client:

1. BFF route `PUT /api/invoices/[id]` proxying `PUT /invoices/{id}` (mirror the existing
   location route's pattern).
2. Drawer edit mode mirroring mobile 16e's scope decisions **exactly** (they're locked):
   date/total/line-item tap-to-fix, amber highlight for low-confidence lines (line-level only),
   product-search reassignment, Confirm/Discard. Discard = `DELETE`, **no credit refund**.
   Merchant tap-to-fix and tag-vocabulary editing stay deferred (16h owns them — endpoints absent).
3. `data-testid` per e2e rule; Playwright case: correct → status flips, `corrected_at` set.

## Tension to respect

Invariant #2: already-emitted `AUTO` observations are immutable (no invoice ref in the store);
correction affects only future emission quality. Do not attempt retroactive repair in the web flow
(16e's memory records this as a settled boundary).
