# 16c — Capture & Upload Vertical Slice

**Mobile epic | Parent: [16](../16-mobile-capture-and-review.md) · Tracker: [16-00](./16-00-handoff.md)**

The capture-first core: photograph or pick a receipt, strip EXIF + compress client-side, run the
`presign → PUT → confirm` flow against the existing backend, and return to a dashboard PROCESSING
row without blocking on parse. This is the thinnest end-to-end value slice.

## Dependencies
- [16b](./16b-mobile-auth.md) (authed `IApiClient`)
- [07 — Core Ingestion Pipeline](../07-core-ingestion-pipeline.md) (presign/confirm endpoints, status machine)

## Capture flow (mirrors the spec + webapp `upload-receipt.ts`)
```
camera capture / gallery pick
  → strip EXIF + compress to ≤1MB JPEG   (client-side, MANDATORY, before any upload)
  → SHA-256 of the final bytes           (dedup key)
  → POST /invoices/presign  { imageSha256, contentType }  → { invoiceId, uploadUrl, ... }
  → PUT bytes to S3 presigned URL (≤300s validity)
  → POST /invoices/{invoiceId}/confirm
  → pop to dashboard immediately with a PROCESSING row
```
- **EXIF strip + ≤1MB JPEG compression are mandatory and client-side** (GDPR — no geotags leave the
  device). Verified by the `exif-data-validator` skill.
- Presign is **idempotent on `imageSha256`** (same tenant) — re-upload of identical bytes returns
  the same `invoiceId` and does not burn quota. Handle the 409 (same-tenant duplicate) and 429
  (quota exceeded) responses with clear UX.
- **Multi-page receipts:** multiple images PUT for one `invoiceId` (repeat presign-per-page or the
  multi-image contract per spec 07 — confirm the exact shape against `PresignService`).

## Native boundaries as ports (per `flutter-architecture-guard.md`)
- `ICameraCapture`, `IGalleryPicker`, `IImageProcessor` (EXIF strip + compress + SHA-256),
  `IS3Uploader` — all abstract in `core/ports/`; concrete adapters
  (`image_picker`, `image`/`flutter_image_compress`, `crypto`, `dio`) in `infrastructure/`.
- `CaptureBloc` orchestrates the flow; widgets stay logic-free.

## Quota pre-check (optional UX)
- `GET /me/usage` to surface remaining uploads before capture; the presign 429 remains the
  authority (memory `household-pool-owner-role-cap` / pool semantics handled server-side).

## Reuse references
- `Source/webapp/src/lib/upload-receipt.ts` (compress → SHA-256 → presign → PUT → confirm, 409/429
  handling) — replicate behavior, not code.
- `Source/backend/src/core/services/ingestion/PresignService.ts` (request/response contract,
  multi-page).

## Out of scope
- Review/correction screen (16e); status pills/polling UI lives in 16d (this slice just inserts the
  PROCESSING row and returns).

## Checklist
- [ ] EXIF strip + ≤1MB JPEG compression client-side before S3 PUT (verified by `exif-data-validator`)
- [ ] Camera / gallery / image-processing / upload defined as ports, adapters in infrastructure
- [ ] `presign → PUT → confirm` against the 07 endpoints; ID token auth
- [ ] SHA-256 dedup key; 409 (duplicate) + 429 (quota) handled with clear UX
- [ ] Multi-page support (multiple images per `invoiceId`)
- [ ] Capture pops to dashboard immediately with a PROCESSING row
- [ ] `CaptureBloc` unit tests (mocked ports); `flutter analyze` clean

## Verification
- A real capture uploads to the **dev** backend; the invoice appears and the worker processes it.
- `exif-data-validator` passes; inspecting the uploaded object shows **no GPS/EXIF** metadata.
- Re-uploading identical bytes returns the same `invoiceId` and does not decrement usage.
