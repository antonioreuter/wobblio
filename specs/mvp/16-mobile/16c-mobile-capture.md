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
- [x] EXIF strip + ≤1MB JPEG compression client-side before S3 PUT (verified by `exif-data-validator`)
      — `ImageCompressUploadPreparer` (`flutter_image_compress`, `keepExif: false`, JPEG re-encode,
      quality 90→40 until ≤1MB), behind `IUploadPreparer`.
- [x] Camera / gallery / image-processing / upload defined as ports, adapters in infrastructure
      — `ICameraCapture`, `IGalleryPicker`, `IDocumentPicker`, `IUploadPreparer`, `IS3Uploader`,
      `IIngestionRepository`; adapters in `infrastructure/adapters/`.
- [x] `presign → PUT → confirm` against the 07 endpoints; ID token auth
      — S3 step is the presigned **multipart POST** (matches `PresignService`/webapp, not a raw PUT);
      `IApiClient` attaches the ID token, `DioS3Uploader` sends no token to S3.
- [x] SHA-256 dedup key; 409 (duplicate) + 429 (quota) handled with clear UX
      — `crypto` SHA-256 over final bytes; `HttpIngestionRepository` maps 409/429/403 → typed
      `UploadException`; `CaptureScreen` surfaces clear copy per code.
- [x] Multi-page support — **images are single-page (one image = one invoice); multipage is the PDF
      path** (one PDF file = one invoice, pages parsed server-side). Backend has no
      multi-image-per-`invoiceId` contract, so PDF is the multipage mechanism. PDF is premium-gated
      (403 handled).
- [x] Capture pops to dashboard immediately with a PROCESSING row
      — pops to `AppShell` with a "Receipt added — processing…" snackbar; the real dashboard row +
      status pills are 16d.
- [x] `CaptureBloc` unit tests (mocked ports); `flutter analyze` clean
      — `test/bloc/capture_bloc_test.dart` (hand-rolled fakes, full pipeline + cancel + 409/429/403 +
      S3/confirm/picker-crash paths); `fvm flutter analyze` → 0 issues, `fvm flutter test` → green.

## Verification
- [x] `exif-data-validator` passes; EXIF strip is centralized in `ImageCompressUploadPreparer`
      (`keepExif: false`) — the only producer of upload bytes, so no raw camera bytes reach S3.
- [ ] **Pending on-device:** a real capture uploads to the **dev** backend; the invoice appears and
      the worker processes it; inspecting the uploaded object shows **no GPS/EXIF** metadata;
      re-uploading identical bytes returns the same `invoiceId` and does not decrement usage.
      (Requires a device/emulator + dev `--dart-define` build; automated gates above are green.)
