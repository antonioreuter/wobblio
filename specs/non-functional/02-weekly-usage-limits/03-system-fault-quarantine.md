# 03 — System-Fault Quarantine & Reprocess

**Non-Functional 02 · Phase 4-5/5 · Fault handling, validation, reprocess-on-behalf**

Parent: [../02-weekly-usage-limits.md](../02-weekly-usage-limits.md) §3 · Index: [README](./README.md)

> **Status (2026-06-28): core shipped; rest carved out.** Implemented here: charge-by-timing (model-ran
> gate, §1 — note the deviation from "extend `CHARGED_STATUSES`", see [00-handoff](./00-handoff.md)),
> `unreadable` verdict (§2), block state + delete-guard (§5), worker quarantine + friendly reasons +
> notify (§4/§6), SSM decommission (§10). **Carved out** (own sub-specs, none block the core):
> presign/worker-start **validation** (§3) → [06](./06-presign-upload-validation.md) — also lands
> `isSystemFault` + the worker user-fault branch; **reprocess-on-behalf** (§7, §8 ops) →
> [07](./07-operator-reprocess-on-behalf.md); **debug-sample + GDPR** (§8 `sample.zip`, §9) →
> [08](./08-debug-sample-gdpr.md), **blocked on DPO/counsel sign-off**.

## Overview

Replace the (now-removed) failure-refund machinery with a fault model where **who pays is decided by WHEN
the failure happens** relative to AI spend, plus a system-fault quarantine + operator reprocess-on-behalf
workflow. Depends on 01 (charging is success-only).

## Design

### 1. Charge-by-timing taxonomy

| When | Examples | Charge |
|------|----------|--------|
| Before the model (validation, presign/worker-start) | unsupported format, oversize, too many pages, same-tenant dup | **Nothing** |
| Model ran (any verdict) | `PARSED`, `NEEDS_REVIEW`, `unreadable` verdict | **Actual tokens** |
| Our crash after model start | constraint drift, Bedrock 5xx/throttle, unanticipated edge, DLQ-final | **Nothing** (quarantine) |

`isSystemFault(err)` in `core/domain/ingestion.ts` = **our-stack-exception only** (reuse
`isNonRetryable`/class-23). A model verdict is never a system-fault.

### 2. Model `unreadable` verdict

Extend `src/prompts/visionParse.ts` + schema: model may return `{ unreadable: true, reason }` for
non-receipt/too-blurry. → `FAILED_PROCESSING`, **deletable**, **charged vision tokens**, reason code
`BLURRY`/`NOT_A_RECEIPT`. Not a system-fault, not quarantined.

### 3. Presign validation (free reject before AI)

`PresignService` / `core/domain/uploadFormat.ts`:
- Allowed: **PDF + images** (JPEG/PNG/HEIC/WebP) only → else 415.
- Per-format size (admin-configurable SSM): images `uploads/max_image_bytes` **5 MB**, PDF
  `uploads/max_pdf_bytes` **10 MB**. Enforced at presign via presigned-POST `content-length-range`.
- PDF pages `uploads/max_pdf_pages` **10** — checked at **worker start** (bytes must exist), before any
  Bedrock call.
- **Promotion loop:** every newly-discovered crash that's detectable up front becomes a new presign rule.

### 4. Friendly, internals-safe reasons

`core/domain/failureReasons.ts`: reason code (`BLURRY`, `NOT_A_RECEIPT`, `UNSUPPORTED_FORMAT`, `TOO_LARGE`,
`SYSTEM_FAULT`) → pre-defined user message. UI shows the message + a "why?" link (sanitized root cause).
Notification carries the same reason. Raw internals never leave the server.

### 5. Block state & delete-guard

`invoice` gains `failure_reason_code TEXT` (any failure), `system_fault_reason TEXT` (internal; quarantine
key — quarantined iff NOT NULL), `blocked_at TIMESTAMPTZ`. `isDeletable()` false when `system_fault_reason`
set → `DeleteInvoiceService` throws `InvoiceBlockedError` → 409. User-fault stays deletable.

### 6. Worker failure path

Delete `refundFailedUpload` + all `UPLOAD_FAILURE_REFUNDS`. Always set `failure_reason_code`. User-fault →
plain `FAILED_PROCESSING`. System-fault → also set `system_fault_reason` + `blocked_at`, notify
(`kind: 'invoice_system_fault'`, friendly reason), log root cause. Idempotent via guarded
`UPDATE ... WHERE status <> 'FAILED_PROCESSING'`.

### 7. Reprocess on the user's behalf (operator-driven)

Original image retained in S3. Operator batch re-enqueues stored file (release ledger claim first — reuse
`DeleteInvoiceService`'s release — then set `PROCESSING`). Success → unblock + `PARSED` + **charge the user
the run's tokens** + notify (`invoice_reprocessed`). **Cross-week:** charge the current week, emit
`reprocess_cross_week` log → `kpi_daily`. "Won't-process" escape demotes to deletable user-fault. Per-week
system-fault threshold (`max_system_faults_per_week`) = **alert-only** (the lock already prevents farming).

### 8. Operator actions (admin, metadata-only except audited debug-sample)

Thin SECURITY DEFINER, admin-route gated, audited:
- `admin_blocked_invoices()` → `(invoice_id, owner_id, system_fault_reason, image_s3_key, blocked_at)` only.
- reprocess / won't-process (above).
- `GET /admin/faults/sample.zip?reason=...` → ≤2 quarantined images per distinct root-cause, ≤300s
  presigned GETs, **opaque image bytes only** (never the tenant-revealing S3 key/path).

### 9. GDPR (debug-sample is pseudonymised personal data — NOT anonymised)

We retain the invoice→owner link and the S3 key encodes the tenant. Lawful basis = legitimate interest +
ToS clause (build a signup-ToS debugging-use clause); minimise (≤2/root-cause); purge samples after debug +
on account deletion (Epic 13). **DPO/counsel sign-off + `gdpr-privacy-officer` review before ship.**

### 10. Decommission SSM

Stop reading `*_failure_refunds_per_week` (remove from `SsmUploadQuotaAdapter` `ALL_PARAMS`/
`getFailureRefundCap` + `quotaConfig.ts` `roleParams('refunds')` + admin param list). Leave SSM values
in place so `load()` won't fail closed.

## Checklist

- [ ] `isSystemFault` taxonomy; vision `unreadable` verdict (prompt + schema)
- [ ] Presign format allow-list + per-format size (presign) + PDF page cap (worker start)
- [ ] `failureReasons.ts` map; "why?" UI; notification carries reason
- [ ] Migration: `failure_reason_code`/`system_fault_reason`/`blocked_at`; `isDeletable` guard → 409
- [ ] Worker routes user-fault vs system-fault; refund path deleted
- [ ] Reprocess (ledger release + re-enqueue), won't-process, cross-week KPI
- [ ] SD fns `admin_blocked_invoices` (incl. `image_s3_key`), reprocess, won't-process; `sample.zip` route
- [ ] ToS clause + GDPR sign-off; samples opaque-bytes-only, audited, ≤300s
- [ ] `validate:security` green; unit + integration tests per parent §8
