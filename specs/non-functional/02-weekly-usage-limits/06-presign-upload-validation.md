# 06 — Presign Upload Validation (free reject before AI)

**Non-Functional 02 · carved out of [03](./03-system-fault-quarantine.md) §3 · deferred from the 2026-06-28 core pass**

Parent: [../02-weekly-usage-limits.md](../02-weekly-usage-limits.md) §3 · Index: [README](./README.md)

## Why this is its own sub-spec

03's core pass shipped the charge-by-timing taxonomy, the `unreadable` verdict, system-fault
quarantine, the delete-guard, and the refund decommission. The **pre-AI validation** half was deferred
because it changes the client upload contract (presigned PUT → POST) and so wants its own review +
webapp/mobile coordination. None of the core pass depends on it.

## Locked decisions (from the 2026-06-28 scoping)

- **Format allow-list = the full spec list incl. HEIC:** PDF + JPEG/PNG/HEIC/WebP. The model can't read
  HEIC directly, so we **rely on client-side conversion to JPEG before the S3 PUT/POST** (the Flutter
  capture rule already exif-strips + compresses to JPEG). Accepting HEIC at presign keeps the contract
  forgiving for clients that hand us the original; the converted bytes are what actually land.
- **Size enforcement = combine both mechanisms:**
  1. **At presign (primary):** presigned **POST** with `content-length-range` so S3 rejects an oversize
     upload *before the bytes land* — saves bandwidth and storage, truly free.
  2. **At worker start (defense-in-depth + page cap):** re-check byte size, and check the PDF page count
     (which needs the bytes), **before any Bedrock call**. Still zero AI tokens.

## Design

### 1. Format allow-list — `core/domain/uploadFormat.ts`
- Add `image/heic` and `image/webp` to `isAllowedUploadType`; extend `extensionFor` /
  `attachmentFormatFromKey`. Disallowed type → `UnsupportedUploadTypeError` → **415** (already wired).
- Confirm the Bedrock image-block path only ever receives a model-supported format (JPEG/PNG/WebP); HEIC
  must have been converted client-side. If a HEIC ever reaches the worker, it is a **user-fault** reject
  (`UNSUPPORTED_FORMAT`), never a quarantine.

### 2. Per-format size — admin-configurable SSM
- New params: `uploads/max_image_bytes` (**5 MB**), `uploads/max_pdf_bytes` (**10 MB**),
  `uploads/max_pdf_pages` (**10**).
- `IUploadQuotaProvider` (or a new `IUploadLimitsProvider` if it reads cleaner) gains
  `getMaxImageBytes()`, `getMaxPdfBytes()`, `getMaxPdfPages()`; `SsmUploadQuotaAdapter` adds them to
  `ALL_PARAMS`. Add to `quotaConfig.QUOTA_PARAMS` so the admin console can edit them.
- **IAM:** add the three paths to `quotaCapPaths` in `WobblioBackendStack` — **both** `apiHandlerFn`
  (presign) **and** `ingestionWorkerFn` (page cap at worker start) need read. Seed them in
  `Source/infra/src/local/seeds/ssm-parameters.ts` and provision dev/prod by hand.

### 3. Presigned POST (the contract change)
- `IS3FileStorage` gains `presignPost(key, contentType, maxBytes, ttlSeconds): Promise<{ url; fields }>`,
  implemented with `createPresignedPost` (`@aws-sdk/s3-presigned-post`, new dep) +
  `Conditions: [['content-length-range', 0, maxBytes]]`. TTL stays ≤ 300s (invariant #10).
- `PresignService.presign` returns `{ invoiceId, url, fields, s3Key }`; `maxBytes` is the per-format cap.
- **Client rewrite (webapp now, mobile when it lands):** switch the upload from `PUT <url>` to a
  multipart `POST <url>` with the returned `fields`. Coordinate so the deploy flips both at once.
- Once live, the post-upload `ConfirmService` PDF byte guard (`MAX_PDF_BYTES = 4_500_000`) is redundant —
  remove it.

### 4. Worker-start checks + the user-fault branch
- In `IngestionService.process` (or a thin guard before the parser), after `getObjectBytes`:
  re-check byte size against the per-format cap; for PDFs, count pages and check `max_pdf_pages`.
  Both run **before** any Bedrock call.
- A breach throws a **user-fault** domain error — `OversizeUploadError` (exists) for size, a new
  `TooManyPagesError` for the page cap. These must **not** quarantine.
- **This is where `isSystemFault` + the worker user-fault branch land** (deferred from 03's core to avoid
  dead code): add `isSystemFault(err)` to `core/domain/ingestion.ts` (our-stack-exception only; returns
  `false` for the user-fault error set `{OversizeUploadError, TooManyPagesError}`). In the worker catch:
  `if (!isSystemFault(err)) { markFailed(invoiceId, reasonCodeFor(err)); continue; }` — plain
  `FAILED_PROCESSING` + `failure_reason_code` (`TOO_LARGE` / `UNSUPPORTED_FORMAT`), no quarantine, no
  charge, no retry/DLQ. Everything else stays the existing `quarantineInvoice` path.
- Add `IInvoiceRepository.markFailed(invoiceId, reasonCode)` (sibling of `markUnreadable`; no
  `system_fault_reason`, stays deletable).

### 5. Promotion loop
Every newly-discovered crash that's detectable up front becomes a new presign/worker-start rule (and,
where possible, moves a fault out of the system-fault bucket into a free pre-AI user-fault reject).

## Notes for the implementer
- `friendlyFailureMessage` already covers `UNSUPPORTED_FORMAT` and `TOO_LARGE` (defined in 03's core).
- The `failure_reason_code` column + `InvoiceDetail.failureReasonCode` projection already exist.
- A user-fault reject should surface the reason in the invoice list/detail so the webapp "why?" link
  (03 §4) can show it — wire the webapp UI here or in a small UI follow-up.

## Checklist
- [ ] HEIC/WebP in the allow-list; HEIC→model never reaches Bedrock (client converts; else `UNSUPPORTED_FORMAT`)
- [ ] Three size/page SSM params + provider getters + admin editability + IAM (api-handler **and** worker) + local seed
- [ ] `presignPost` (content-length-range) + `PresignResult.fields`; webapp PUT→POST; remove redundant ConfirmService byte guard
- [ ] Worker-start byte + PDF-page checks before any Bedrock call
- [ ] `isSystemFault` + worker user-fault branch + `markFailed`; user-fault → plain FAILED_PROCESSING (no quarantine/charge/retry)
- [ ] `validate:security` green; unit + integration tests per parent §8
