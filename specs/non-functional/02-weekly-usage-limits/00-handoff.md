# 00 — Living Handoff (Non-Functional 02 · Weekly Usage & Credit Limits)

Resume point across context resets. Implement one sub-spec at a time, update this file + the
[README](./README.md) Build Status table as each lands. Parent intent: [`../02-weekly-usage-limits.md`](../02-weekly-usage-limits.md);
this folder is authoritative where it overrides the parent (see README "Locked decisions").

## Build status

| # | Sub-spec | Status | Notes |
|---|----------|--------|-------|
| 01 | [Credit Core](./01-credit-core.md) | **Done** (2026-06-28) | See below |
| 02 | [UI Copy](./02-ui-copy.md) | **Done** (2026-06-28) | Credits-first copy + `.toLocaleString()`; fixed "5 members"→3 (incl. 2 spots beyond spec); dashboard warn threshold `10000` not spec's `30000` (collided with STANDARD cap → always amber) |
| 03 | [System-Fault Quarantine](./03-system-fault-quarantine.md) | **Done — core** (2026-06-28) | Charge-by-timing + `unreadable` + quarantine + delete-guard + refund decommission. See below |
| 04 | [Household Carry-Over](./04-household-carryover.md) | **Done** (2026-06-28) | Carry-over + `/me/usage` pool-only flip. See below |
| 05 | [Churn Detection](./05-churn-detection.md) | Deferred | |
| 06 | [Presign Upload Validation](./06-presign-upload-validation.md) | **Done** (2026-06-28) | Allow-list +HEIC/WebP, presigned POST (PUT→POST), 3 size/page SSM params, worker-start validation, `isSystemFault` user-fault branch. See below |
| 07 | [Operator Reprocess-on-Behalf](./07-operator-reprocess-on-behalf.md) | **Done** (2026-06-28) | 3 SD fns, reprocess/won't-process, cross-week KPI rollup, alert metric, `/admin/faults` route + page. See below |
| 08 | [Debug-Sample Endpoint (GDPR)](./08-debug-sample-gdpr.md) | **Built — ship-blocked (legal)** (2026-06-28) | Endpoint built **default-OFF** (`DEBUG_SAMPLE_ENABLED`); DPO/counsel sign-off + ToS clause + gdpr-officer review still required before enabling. See below |

Recommended sequence: **01 → 02 → 03 (core) → 06 → 07 → 08 (default-off)**. **Epic code-complete except 05
(churn, deferred by product) and 08's legal sign-off** (08 is built but ships OFF until DPO/counsel/ToS land).

## What 01 shipped

Quota moved from invoice-count to **credits (1 credit = 1 LLM token)**. Presign is read-only; the
ingestion worker charges **actual** tokens on success only.

- **Migrations** (`Source/infra/src/migrations/`): `…120000_add_credits_to_quota_counter.ts` (standalone
  enum add — `CREDITS`, `HOUSEHOLD_CREDITS`) and `…120100_repoint_admin_quota_to_credits.ts` (admin
  `SECURITY DEFINER` fns now read/write `counter='CREDITS'`). Separate files because PG forbids using a
  new enum value in the tx that added it. Apply as the **object-owner** role (`wobblio_dev_app`).
- **Caps → credits**: `SsmUploadQuotaAdapter` returns `invoice_limit × average_tokens_per_invoice`
  (`-1 → Infinity` applied **before** multiplying). New provider method `getAverageTokensPerInvoice()`.
  New SSM param `/wobblio/config/quotas/average_tokens_per_invoice`.
- **Quota core**: `QuotaType = 'CREDITS' | 'HOUSEHOLD_CREDITS'`; `increment/decrement(…, amount)`;
  `reserveUpload` split into `checkAvailability(…, inFlightCredits)` (read-only) + `charge(…)`.
  `UploadAllowanceResolver` returns credit counters — one matrix for presign, `/me/usage`, worker.
- **Presign burst guard**: projects in-flight `PROCESSING` uploads × avg tokens onto used before the
  cap check (`IInvoiceRepository.countInFlightUploads`). Closes the check-only burst window.
- **Token metering**: `TokenMeter` + `MeteringBedrockConverse`/`MeteringBedrockEmbedder` decorators
  accumulate every model call's tokens (incl. Titan embedder — port now returns `{embedding,
  inputTokens}` from `inputTextTokenCount`, and emits an `EMBEDDING` `bedrock_usage` log). The
  data-intelligence services stay unaware of quota. **Deviation from the spec text:** tokens are read
  from the meter in the worker rather than threaded through `IngestionOutcome` — same result, less churn.
- **Worker charge**: `chargeIngestion` runs **before** the existing `COMMIT` (atomic with the ledger
  claim + invoice rows), gated by `shouldChargeIngestion(handled, status)` where
  `CHARGED_STATUSES = {PARSED, NEEDS_REVIEW}`. `refundFailedUpload` deleted; `markInvoiceFailed` keeps
  only the status flip.
- **`/me/usage`** reads `CREDITS` + `HOUSEHOLD_CREDITS`, **keeps the personal + pool sum** (pool-only
  flip is 04's job). `householdRoutes.getHousehold` pool `used` also reads `HOUSEHOLD_CREDITS`.
- **IAM**: `average_tokens_per_invoice` added to `quotaCapPaths`; the quota-cap `GetParameters` grant is
  now applied to the **ingestion-worker** too (it loads the batch in `chargeIngestion` — a missing grant
  would roll the ingestion back, not silently swallow like the old refund did).

## What 03 (core) shipped

The pre-AI **validation** half, the **operator reprocess** workflow, and the **GDPR debug-sample** endpoint
were carved out to 06/07/08 (the first changes the upload contract; the last is blocked on legal). The
core charge-by-timing + quarantine landed:

- **Charge-by-timing — model-ran gate, NOT a status allowlist (deviation from spec text).** Spec §03 said
  "extend `CHARGED_STATUSES`". Instead `shouldChargeIngestion(handled, modelTokens)` charges iff a model
  ran (`meter.total > 0`). This resolves the `FAILED_PROCESSING` collision (an `unreadable` verdict and a
  quarantined crash share that status, but only the former ran a model) and self-maintains. **Behaviour
  change:** `SUSPECTED_DUPLICATE` now charges (it ran the vision model); previously it didn't.
- **Vision `unreadable` verdict** (`prompts/visionParse.ts` → **v8**, `receiptSchema.ts`): the model may
  return `{ unreadable: true, reason: 'BLURRY'|'NOT_A_RECEIPT' }`. It flows through the normal outcome
  path (not an exception), so it's **charged**, and `IngestionService` fails the invoice
  `FAILED_PROCESSING` + `failure_reason_code` via `markUnreadable`, **deletable** (user-fault).
- **Migration** `…140000_invoice_fault_quarantine.ts`: `failure_reason_code`, `system_fault_reason`
  (quarantine key — quarantined iff NOT NULL), `blocked_at`. Plain `ALTER TABLE … ADD COLUMN IF NOT
  EXISTS` (TEXT codes, no enum → single transaction). Apply as object-owner `wobblio_*_app`.
- **Worker quarantine** (`ingestion-worker/index.ts`): every our-stack crash (class-23 fast-fail or
  final-delivery) now `quarantineInvoice` → `repo.quarantine` (FAILED_PROCESSING + SYSTEM_FAULT +
  internal root cause + `blocked_at`, idempotent guard) + best-effort `invoice_system_fault` notification
  (friendly `failureReasons.SYSTEM_FAULT` copy, ttl 7d). No charge (rolled-back run). `quarantine` returns
  a **transition flag** (`rowCount > 0`); the notification fires **only on the transition** so an SQS
  redelivery/DLQ redrive of an already-quarantined invoice never re-notifies (code-review fix).
- **Delete-guard**: `isDeletable(status, systemFaultReason)` is the **single source of truth** — false for
  PROCESSING and for any quarantined invoice (`!= null`). `DeleteInvoiceService` checks the fault first to
  surface a distinct `InvoiceBlockedError` (→ **409**), then defers to `isDeletable`, so any future delete
  path (admin/bulk) inherits the hold. User-fault FAILED_PROCESSING (unreadable) stays deletable.
- **Quarantine clears on success**: `persistParsed` (and `markUnreadable`) null out
  `failure_reason_code`/`system_fault_reason`/`blocked_at`, so a 07 reprocess that succeeds (or comes back
  unreadable) is never left permanently un-deletable (code-review fix).
- **`failureReasons.ts`** (new domain): code→friendly-message map (BLURRY, NOT_A_RECEIPT,
  UNSUPPORTED_FORMAT, TOO_LARGE, SYSTEM_FAULT). `InvoiceDetail.failureReasonCode` now exposed for the
  webapp "why?" surface (UI itself is a follow-up, with 06).
- **Refund decommission** (Locked decision #4 / spec §10): `SsmUploadQuotaAdapter` no longer loads
  `*_failure_refunds_per_week`; `quotaConfig.QUOTA_PARAMS` drops them (`QuotaKind` = `uploads|household`,
  9→5 params); `WobblioBackendStack.quotaCapPaths` drops the 4 refund grants. SSM values left in place.
- **Deferred to 06** (to avoid dead code): `isSystemFault` + the worker **user-fault** branch land with
  06's worker-start checks (the only worker-thrown user-fault errors come from there).

## What 04 shipped

§6.3 mid-week credit carry-over so forming/dissolving a household can't reset weekly spend, plus the
`/me/usage` pool-only flip that 01 deliberately left for here.

- **Two SECURITY DEFINER carry-over fns** (`…150000_household_credit_carryover.ts`), both **atomic single
  statements** (the "math in TS" the spec mentions is trivial — a copy and a `GREATEST` — and both cross the
  owner↔household RLS boundary the triggering user can't, so SD is mandatory):
  `carry_over_household_pool_on_activate` (pool `HOUSEHOLD_CREDITS.used := owner CREDITS.used`, **overwrite**
  so a re-activation after a settle restarts from the owner's current spend) and
  `settle_household_pool_to_owner` (owner `CREDITS.used := GREATEST(owner, pool)`). `week_start` is **passed
  in from TS** (domain `weekStart`, Monday-UTC) so it never drifts on the DB session timezone. EXECUTE is
  auto-reconciled to the runtime role by `deploy.sh` (`GRANT EXECUTE ON ALL FUNCTIONS`).
- **`HouseholdCarryOverService`** (new core service) holds only the *decision* of which transition fires from
  member counts: `onMemberJoined` (activate iff count **==** `MIN_MEMBERS_FOR_POOL`), `onMemberRemoved`
  (settle iff count-before **==** `MIN_MEMBERS_FOR_POOL`, i.e. 2→1), `onDisband` (settle iff count-before
  **≥** `MIN_MEMBERS_FOR_POOL`). `settlePoolOnLeave`/`settlePoolOnDissolve` from the spec are **one**
  `settlePoolToOwner` repo method (byte-identical logic — Rule-of-Three).
- **Wired into 4 transition points** (not 5 — `create` is always a solo owner, so wiring it would be dead
  code): `HouseholdInviteService.acceptInvite` (only on a fresh `OK` join, **never** `ALREADY_MEMBER`, else a
  re-accept would reset the pool mid-week) → activate; `HouseholdService.leave`/`removeMember` → settle;
  `disband` now **pre-checks ownership** (so the pool is settled only for the real owner, before the
  household row is torn down). **Behaviour change:** a true non-member on disband/leave/**removeMember** now
  gets **404** (not a member) instead of 403 — consistent across the three, better info-hiding (code-review).
- **`/me/usage` pool-only flip**: when pooled, `used` is the `HOUSEHOLD_CREDITS` counter alone (was
  `personal + pool`). Carry-over already copied the owner's pre-pool spend into the pool, so summing would
  double-count. Solo users are unchanged (personal counter).
- **Out of scope (consciously):** "PREMIUM-via-household revoked" in the spec prose — no such grant exists
  (`hasPremiumAccess` is role-only); it's a separate access feature, not a credit-conservation concern, and
  not in the 04 checklist.
- **Tests:** `HouseholdCarryOverService` unit (decision matrix + default-clock), updated Household/Invite
  service unit (wiring + ALREADY_MEMBER skip + disband ownership), and a real-Postgres integration test
  (`HouseholdCreditCarryover.local.test.ts`) proving conservation across activate → pool spend → settle.

## What 06 shipped

Pre-AI upload validation (free rejects before any Bedrock call) + the presigned-POST contract change.

- **Format allow-list +HEIC/WebP** (`domain/uploadFormat.ts`): `UploadFormat` gains `webp`/`heic`;
  `extensionFor`/`attachmentFormatFromKey` extended; new `isModelReadableFormat()` (HEIC = false).
  `BedrockImage.format` gains `'webp'` (Converse accepts it natively — no adapter change). HEIC is accepted
  at presign (forgiving contract) but a raw HEIC reaching the worker is a **user-fault** reject.
- **Presigned POST (PUT→POST contract change)**: new dep `@aws-sdk/s3-presigned-post`; `IS3FileStorage`
  swaps `presignPut` → `presignPost(key, contentType, maxBytes, ttl) → {url, fields}` with a
  `content-length-range` condition so **S3 rejects oversize before the bytes land** (TTL still ≤300s).
  `PresignService` returns `{invoiceId, url, fields, s3Key}`; **webapp `upload-receipt.ts` flipped to a
  multipart POST** (fields then `file` last) + client PDF guard. The redundant
  `ConfirmService` byte guard (and its `handleConfirm` 413 mapping) is **removed**.
- **Three admin-editable size/page SSM params** (`max_image_bytes`=5MB, `max_pdf_bytes`=4.5MB —
  lowered from 10MB in the post-06 review fix below, `max_pdf_pages`=10): new
  **`IUploadLimitsProvider`** (ISP-separate from `IUploadQuotaProvider`),
  implemented by the same `SsmUploadQuotaAdapter` off one cached batch; added to `quotaConfig.QUOTA_PARAMS`
  (new `kind:'upload_limit'`, surfaced in the admin quotas section) + `WobblioBackendStack.quotaCapPaths`
  (api **and** worker) + local seeds.
- **Worker-start validation** (`IngestionService.process` → `assertUploadWithinLimits`, before any model
  call): byte size vs per-format cap → `OversizeUploadError`; non-model-readable format (HEIC) →
  `UnsupportedUploadTypeError`; PDF page count (dep-free `domain/pdf.ts countPdfPages`, undercounts on
  object-stream PDFs — safe direction) > cap → new `TooManyPagesError`.
- **`isSystemFault` + worker user-fault branch** (deferred from 03): `domain/ingestion.ts` adds
  `isSystemFault(err)` (false only for `{Oversize, TooManyPages, UnsupportedUploadType}`) +
  `uploadFailureReasonCode(err)` (→ `TOO_LARGE`/`UNSUPPORTED_FORMAT`). New worker catch **first branch**:
  `if (!isSystemFault(err)) { failUserFault → markFailed; continue; }` — plain `FAILED_PROCESSING` + reason
  code, **deletable**, no quarantine/charge/retry/DLQ. New `IInvoiceRepository.markFailed` (sibling of
  `markUnreadable`, nulls system-fault columns).
- **S3 bucket CORS** (`WobblioStorageStack` + local bootstrap) is now **`POST`-only** — the presigned-PUT path
  was removed, so PUT was dropped (least-privilege). The webapp `file` part carries a filename (S3 requires it
  to treat the part as an object).

## Code-review fixes (post-06, 2026-06-28)

A high-effort review of the 06 delta surfaced these; all fixed in this batch:

- **`max_pdf_bytes` lowered 10 MB → 4.5 MB (regression).** 10 MB exceeded Bedrock Converse's ~4.5 MB
  document limit (the reason the removed `ConfirmService` guard was 4.5 MB), so a 4.5–10 MB PDF passed the
  presign + worker-start checks, crashed Bedrock, and quarantined as a **system fault** (undeletable, "our
  fault" notify, 3 retries) instead of a clean user-fault reject. PDF cap is now Bedrock-safe in both seeds +
  the webapp client guard (4.5 MB). `max_image_bytes` stays 5 MB (webapp compresses to ≤1 MB). **Spec said
  10 MB — this deliberately deviates.**
- **0-byte upload guard:** `presignPost` `content-length-range` min is now **1** (was 0) — an empty body would
  otherwise pass the worker size check and crash Bedrock into a wrong system-fault quarantine.
- **Allow-list format check (was a 1-item denylist):** `isModelReadableFormat` (`!== heic`) → type-predicate
  `isImageBlockFormat` (jpeg/png/webp); `IngestionService.parseUpload` routes by format with **no cast** and
  rejects any non-image/non-pdf as a user-fault — a future accepted-but-unreadable format now defaults to
  "reject" instead of being mislabeled to Bedrock.
- **`UNSUPPORTED_FORMAT` copy** no longer lists HEIC as supported (it's the rejected format); now says "convert
  HEIC photos to JPEG first."
- **`bootstrap.sh`** now provisions every `SsmUploadQuotaAdapter`-required quota param (tester/admin caps,
  `average_tokens_per_invoice`, the 3 §06 size/page limits) with safe inline defaults — the adapter fails closed
  on any missing param, and the script was missing these (a deploy landmine).
- **Cleanup:** collapsed the 4 duplicate SSM getters into a private `value(param)`; removed the stale "PUT"
  comments (webapp header).

**Second review pass (post-fix) added:**
- **Error-priority regression fixed:** moving the format check into `parseUpload` (runs after the size check)
  meant an oversize HEIC reported `TOO_LARGE` instead of `UNSUPPORTED_FORMAT`. Restored the format check to
  the **front** of `assertUploadWithinLimits`; `parseUpload`'s reject is now the (type-safe, unreachable) fallback.
- **`SsmUploadQuotaAdapter.load()` now fails closed on a non-integer value too** (not just missing) — a NaN
  would otherwise disable the size/page guards (`bytes.length > NaN` is false).
- Dropped the now-unused `requestChecksumCalculation: 'WHEN_REQUIRED'` S3 client setting (it existed only for
  the removed presigned-PUT path); dropped the dead `'refunds'` member from the admin `Quota.kind` union;
  aligned the 10 MB→4.5 MB PDF-cap test fixtures.
**Third review pass (standing findings actioned):**
- **`max_pdf_bytes` footgun closed (was the operator-footgun note).** New domain constant
  `BEDROCK_MAX_PDF_BYTES = 4_500_000`: `SsmUploadQuotaAdapter.getMaxPdfBytes` **hard-clamps** to it at read
  time (so a stale/manually-set 10 MB SSM value can't push a PDF into the Bedrock-quarantine range), and
  `quotaConfig` adds a per-param `max` that `normalizeQuotaValue` enforces (the admin edit is rejected with
  "value must be ≤ 4500000"). This also makes the **webapp's hardcoded 4.5 MB client guard correct** (4.5 MB
  is now the true ceiling) and neutralizes the **bootstrap.sh stale-value** concern (read clamp wins regardless).
- **`SsmUploadQuotaAdapter` is now a per-container singleton** (`shared.ts uploadQuotaAdapter()`) with a **5-min
  TTL'd cache** — the api-handler no longer re-fetches the SSM batch on every `/me/usage`, `/presign`, and
  household-detail call; the TTL bounds how stale an admin edit can be. (worker keeps its own per-container instance.)
- **`QuotaExceededError` now reports the real projected `used`** (stored used + in-flight projection) instead of
  `cap, cap`, so the CloudWatch quota-block log is informative. One extra `getUsed` only on the rare reject path.

### Still deferred (need a call — not quick/safe fixes)
- **Class-23 → system-fault quarantine** is **by design**: most class-23 in this pipeline are our-stack CHECK
  drift (fixed by shipping a migration + operator reprocess). A genuinely user-data class-23 is handled by **07's
  won't-process escape** (operator demotes it to a deletable user-fault). No code change.
- **Charge (persisted `quota_pooled`) vs `/me/usage`/presign (live resolve) divergence** after a mid-week
  membership change: on analysis this is a **minor one-scan leak in a narrow race** (a pooled in-flight upload
  charged after the dissolve-settle lands in `HOUSEHOLD_CREDITS` and isn't re-settled to the owner), not
  systemic under-enforcement. A proper fix needs a settle-after-charge mechanism; kept deferred as low-severity.

### Reviewed, deferred (not fixed — need a product/architecture call)
- **PDF page cap is best-effort:** `countPdfPages` undercounts compressed/object-stream PDFs (returns 1). Now
  lower-risk since the 4.5 MB byte cap is the hard Bedrock-enforced bound; kept as defense-in-depth.
- **Charge vs display divergence:** the worker charges persisted `quota_pooled`, but `/me/usage` + presign still
  re-derive pool membership live, so a member who uploads pooled then leaves has the charge land in
  `HOUSEHOLD_CREDITS` while their `/me/usage` reads personal `CREDITS`. Part of the deferred display-consistency
  item; a proper fix threads the persisted attribution into the read seam.
- **api-handler builds `SsmUploadQuotaAdapter` per request** (cold SSM cache); hoist to a module singleton like
  the worker. Pre-existing efficiency nit.
- **Out of scope (consciously):** the webapp "why?" failure-reason UI (03 §4 / 06 notes) — `failureReasonCode`
  is already projected on `InvoiceDetail`; the surface itself is a small UI follow-up.
- **Tests (+14):** `pdf.test`, `isSystemFault`/`uploadFailureReasonCode` in `ingestion.test`,
  worker-start guards in `IngestionService.test`, HEIC/WebP + `isModelReadableFormat` in `uploadFormat.test`,
  3 size params in `SsmUploadQuotaAdapter.test`/`quotaConfig.test`/`AdminQuotaConfigService.test`; updated
  `PresignService.test` (POST shape) + `ConfirmService.test` (dropped byte guard).

## What 07 shipped

Operator reprocess-on-behalf for system-fault-quarantined invoices (03 quarantines; 07 lets an operator
fix the root cause and re-run from the retained S3 file — the user never re-uploads).

- **3 thin SECURITY DEFINER fns** (`…170000_admin_fault_reprocess.ts`, owner-role, EXECUTE reconciled by
  `deploy.sh`): `admin_blocked_invoices()` (metadata-only list), `admin_reprocess_invoice(id)` (single CTE:
  release ledger + reset to PROCESSING + clear quarantine, `RETURNING tenant_id, s3_key`), and
  `admin_wont_process_invoice(id, reason_code)` (clear quarantine, keep FAILED_PROCESSING, set reason code).
  Each guarded `system_fault_reason IS NOT NULL` so re-invocation is a no-op; columns qualified to dodge the
  LANGUAGE-sql OUT-param ambiguity.
- **`IFaultAdminRepository` + adapter** wrap the 3 fns; **`AdminFaultService`** orchestrates: `listBlocked`
  (+ `thisWeekCount`/`threshold`/`overThreshold` from a new **`SsmSystemFaultLimitsAdapter`** reading
  `max_system_faults_per_week` — §07.4 **alert-only**), `reprocess(actor, ids[])` (SD reset → re-enqueue
  `{…, reprocess:true}` → audit `fault.reprocess`, skips unblocked), `wontProcess` (SD → `invoice_unprocessable`
  notify → audit `fault.wont_process`). New `UNPROCESSABLE` failure reason.
- **`/admin/faults` route** (`adminFaultRoutes.ts`, registered in `adminRoutes.ts`, ADMIN-gated + audited):
  GET list, POST `/reprocess` (batch), POST `/{id}/wont-process`. **Admin console page** `(console)/faults` +
  nav item ("System Faults"): blocked-invoice list (metadata only), batch reprocess, per-row won't-process,
  over-threshold alert banner.
- **Worker:** `IngestionMessage` gains optional `reprocess?: boolean`; `findChargeTarget` also returns
  `createdAt`. On a successful reprocess (PARSED/NEEDS_REVIEW) the worker fires `invoice_reprocessed` (notify +
  push, best-effort post-COMMIT); when the charged week ≠ the invoice's original week it emits
  `log.info('reprocess cross week', { invoiceId, tokens, originalWeek, chargedWeek })`.
- **Cross-week KPI rollup (§07.5, no EMF):** `IReprocessCrossWeekSource` + `CloudWatchLogsReprocessAdapter`
  (`filter msg="reprocess cross week" | stats count(*), sum(tokens) by chargedWeek`) +
  `reprocessKpi.toReprocessCrossWeekRows` + `ReprocessCrossWeekRollupService`, registered as the **4th rollup**
  in `cron-ingestion-metrics-rollup` (`reprocess_cross_week_count`/`_tokens` → `kpi_daily`).
- **Known edge (logged):** if `queue.enqueue` fails *after* the SD reset, the invoice is PROCESSING but unsent
  and off the blocked list → caught by the existing stuck-invoice cron. SQS enqueue failure is rare.

## What 08 shipped (built default-OFF — NOT cleared to ship)

⚠️ **Legal ship-blocker stands.** The endpoint is built but **inert** until **DPO/counsel sign-off + a
gdpr-privacy-officer review + a signup-ToS debugging clause** exist. It is gated behind
`DEBUG_SAMPLE_ENABLED` (env), which is **absent from the CDK** — so it cannot be enabled without a deliberate,
post-sign-off env change. The 08 spec's three legal checklist items remain **unchecked**.

- **`GET /admin/faults/sample.zip?reason=<root-cause>`** (ADMIN-gated, audited). Returns 403 unless
  `DEBUG_SAMPLE_ENABLED=true`. Response is `{ filename, count, zipBase64 }` (avoids API-GW binary config).
- **`AdminDebugSampleService`**: ≤2 quarantined images per exact root cause, fetched **server-side**
  (`getObjectBytes` — no presigned URL or key leaves the server, stricter than the spec's presigned-GET),
  zipped under **opaque names** (`sample-N.<ext>`) via a new `IZipArchiver`/`JsZipArchiverAdapter` (jszip).
  Audited as `fault.debug_sample` = actor + reason + **count, never the tenant**. Nothing persisted
  server-side → no retained copy to purge (the spec's purge obligation is satisfied by non-retention; any
  operator-downloaded zip is outside our system, which is exactly what the ToS/legal gate governs).
- **De-identification:** opaque filenames, no S3 key/path/owner/metadata in the zip; `Promise.allSettled` so a
  since-purged object is skipped, not fatal.
- **No new IAM** — the api-handler already has `grantRead` + KMS-decrypt on the uploads bucket.

## Operator debug → promote loop (how 03/07/08 + the replay tool fit together)

When a real receipt fails in prod, the full loop is: **quarantine (03)** → engineer pulls the failing image via
**08 `GET /admin/faults/sample.zip`** (only after the legal flag is enabled) → reproduce locally with
**`cd Source/backend && npm run replay -- <image>`** (`src/local/replay-receipt.ts` — runs the real worker against
the local stack and prints PARSED / NEEDS_REVIEW / QUARANTINED) → fix + re-run replay until ✅ → ship → **07
reprocess-on-behalf** re-runs the user's stored invoice (charges the run, notifies them; the user never re-uploads).
The replay tool is dev-only test-data tooling (no GDPR surface) and is the standing way to reproduce any parse/
ingestion fault locally — it does NOT depend on 08 (08 just supplies the bytes when the failure is a prod user's).

## Code-review fixes (post-07/08, 2026-06-28)

A focused high-effort review of the 07+08 surface (3 finder angles incl. a GDPR/SQL angle) surfaced these; all fixed:

- **GDPR leak (HIGH): `GET /admin/faults` returned the tenant-encoding `imageS3Key`** (`receipts/{tenantId}/{sha}…`)
  to the admin client. `AdminFaultService.listBlocked` now maps to a `FaultListItem` that **drops `imageS3Key`**
  (the SD fn + repo keep it only for the server-side debug-sample fetch); the admin page no longer renders it.
- **Reprocess batch isolation (HIGH):** `reprocess` now wraps each invoice in try/catch — one failure (no-longer-
  blocked, or an SQS enqueue error) no longer aborts the batch. The rare enqueue-after-reset strand (invoice in
  PROCESSING, off the list) is recovered by the existing `fail_stuck_invoices` data-retention reaper → deletable
  FAILED. Documented.
- **Debug-sample resilience:** `Promise.all` → `Promise.allSettled` so one missing S3 object doesn't fail the
  whole sample (names stay contiguous).
- **Alert at the threshold:** `overThreshold` is now `thisWeekCount >= threshold` (fires *at* the limit, not one
  fault late).

### Reviewed, not changed (by design)
- Reprocess landing as `SUSPECTED_DUPLICATE`/unreadable doesn't fire `invoice_reprocessed` — only PARSED/
  NEEDS_REVIEW (a usable result) does; a duplicate/unreadable outcome is surfaced in the user's list / "why?".
- `max_system_faults_per_week` not runtime-editable from the console (mirrors `SsmWaitlistCapAdapter`; SSM-set).
- `thisWeekCount` uses `blocked_at::text` session-TZ date — same TZ class as the pre-existing deferred item; RDS is UTC.

## Code-review fixes (post-04, 2026-06-28)

A high-effort review of the whole 02 diff surfaced three issues fixed in this batch (the rest are
logged under "Deferred / carried debt — review findings not yet actioned"):

- **Charge by the persisted presign decision, not a live re-resolve (the accounting bug).** The worker's
  `chargeIngestion` re-resolved pool-vs-personal from **current** membership, so a join/leave in the
  presign→worker window charged the wrong counter (e.g. a leaver's household receipt billed to personal).
  Keying off the stamped `household_id` alone is **unsafe** — a solo (1-member) household stamps
  `household_id` but charges personally, so that shortcut would let a solo owner spend into an unchecked
  `HOUSEHOLD_CREDITS`. Fix: persist the decision. New migration **`…160000_invoice_quota_pooled.ts`**
  (`invoice.quota_pooled BOOLEAN NOT NULL DEFAULT false`); `PresignService` stamps `quotaPooled:
  allowance.isPool`; new `IInvoiceRepository.findChargeTarget` → `{quotaPooled, householdId}`;
  `chargeIngestion` charges `pooled ? HOUSEHOLD_CREDITS@householdId : CREDITS@tenantId` from that row.
- **Raw `pg` in the worker handler removed (fixed for free by the above).** The rewritten charge no longer
  needs the role/membership re-resolve, so the `SELECT role FROM app_user …` query and the worker's
  `UploadAllowanceResolver`/`SsmUploadQuotaAdapter`/`HouseholdRepositoryAdapter` wiring are gone (was a
  `Source/backend/CLAUDE.md` "direct pg calls from handlers" reject; also drops the discarded-`cap` waste).
- **`getHousehold` no longer duplicates the §2.4 cap matrix.** Extracted
  `UploadAllowanceResolver.householdPoolCap(householdId, callerUserId, callerRole)`; `resolve()` and the
  household-detail route share it, so the displayed pool cap can't drift from the enforced one.

## ⚠️ Manual ops before this is live on dev/prod (SSM is provisioned by hand)

1. **Add** `/wobblio/config/quotas/average_tokens_per_invoice = 10000` to **dev and prod** SSM.
2. **Set** `/wobblio/config/quotas/household_uploads_per_week` **20 → 15** in **prod** (dev/local already 15).
3. **Calibrate `average_tokens_per_invoice` from real `bedrock_usage` before launch** (per-stage summed
   per `invoiceId`, p50/p75). The legacy 10k was never derived; embedder tokens now appear in
   `bedrock_usage` (stage `EMBEDDING`) so the all-model sum is finally measurable. This de-risks pricing.
4. Confirm migrations run as `wobblio_*_app` (owner) so the repointed `SECURITY DEFINER` fns work.
5. **03 — apply `…140000_invoice_fault_quarantine.ts`** to dev/prod (object-owner role). No new SSM here
   (06 adds the size/page params). The `*_failure_refunds_per_week` SSM values can stay (now unread).
6. **04 — apply `…150000_household_credit_carryover.ts`** to dev/prod (object-owner role). No new SSM.
   `deploy.sh` already reconciles EXECUTE on the two new SD fns to the runtime role.
7. **Review fix — apply `…160000_invoice_quota_pooled.ts`** to dev/prod (object-owner role). No new SSM.
   Adds `invoice.quota_pooled`; the worker reads it to charge the counter presign authorized.
8. **06 — add 3 SSM params** to **dev and prod**: `/wobblio/config/quotas/max_image_bytes=5000000`,
   `max_pdf_bytes=4500000` (Bedrock-safe; **not** 10000000), `max_pdf_pages=10` (local seeds already updated;
   `bootstrap.sh` now provisions these + tester/admin caps + `average_tokens_per_invoice` with defaults).
   `SsmUploadQuotaAdapter` fails closed on a missing param, so seed before deploy. No migration.
   **Coordinate the webapp PUT→POST
   deploy** with the backend (the upload contract flips atomically; mobile doesn't exist yet).
9. **07 — apply `…170000_admin_fault_reprocess.ts`** to dev/prod (object-owner role); `deploy.sh` reconciles
   EXECUTE on the 3 new SD fns. **Add SSM** `/wobblio/config/quotas/max_system_faults_per_week=25` (api-handler
   reads it for the faults alert; `bootstrap.sh` + local seeds already set it). No new IAM beyond the stack
   change (already in `WobblioBackendStack`). Local DB migrated through `…170000`.
10. **08 — DO NOT ENABLE until legal sign-off.** The endpoint ships **OFF** (`DEBUG_SAMPLE_ENABLED` unset; it is
    intentionally **not** in the CDK). Before enabling: ① DPO/counsel sign-off, ② `gdpr-privacy-officer` rule
    review, ③ signup-ToS debugging clause live. Only then set `DEBUG_SAMPLE_ENABLED=true` on the api-handler.
    `jszip` is a new backend dependency. No migration, no SSM, no IAM change for 08.

## Deferred / carried debt

- Failure-refund SSM params (`*_failure_refunds_per_week`) + the `UPLOAD_FAILURE_REFUNDS` enum value still
  exist (harmless). 03 stopped the adapter **loading** them and dropped them from the admin surface + IAM;
  the SSM values + enum are left in place (no destructive migration). Drop in a later cleanup if desired.
- `CHARGED_STATUSES` was **replaced** in 03 by the model-ran gate (`shouldChargeIngestion(handled,
  modelTokens)`); see "What 03 (core) shipped". No status allowlist remains to extend.
- Cutover: accept the one-time counter reset (no backfill of legacy `UPLOADS` → `CREDITS`).
- **Code-review findings consciously NOT changed** (don't re-flag): (a) `notifySystemFault` repeats the
  `create + best-effort push` pattern from `BudgetRecyclerService` — only **2** occurrences, so Rule-of-Three
  says don't abstract yet; promote to a `NotificationService.notify()` seam on the **3rd** consumer.
  (b) The charge gate keys on `meter.total > 0` rather than an explicit "model ran" signal — correct by
  design (a real parse always spends input tokens); a metering-decorator bug is a separate concern.
- **Review findings not yet actioned** (raised 2026-06-28, deferred — decide before launch):
  (#2) a charge-write failure inside the tenant tx rolls back an otherwise-good parse and, on final
  delivery, quarantines it as `SYSTEM_FAULT` (undeletable) — atomicity by design, but a failed credit
  write shouldn't strand a correct parse. (#3) two truly-concurrent presigns each miss the other's
  uncommitted in-flight row, so a burst can overshoot the cap by one invoice (`countInFlightUploads`
  only sees committed `PROCESSING` rows). (#4) `getHousehold` shows an active pool (`used/cap`) even for
  a solo <2-member household, where uploads actually charge personal. (#5) `isNonRetryable` blanket-
  quarantines **all** PG class-23 errors as `SYSTEM_FAULT`, so a user/data-caused constraint becomes an
  undeletable "our fault". (#6) `countInFlightUploads` `created_at >= $2::date` casts the Monday-UTC
  weekStart in the **session** timezone — wrong window near the boundary if the session isn't UTC.
  Lower-sev cleanups also logged: `QuotaExceededError(counter, cap, cap)` fabricates `used`;
  `IQuotaRepository.decrement` is now dead; `*_failure_refunds_per_week` still seeded in
  `ssm-parameters.ts`/`WobblioLocalBootstrapStack.ts`; Infinity→`null` quota serialization duplicated
  across `householdRoutes` + `handleUsage`.

## Validation (all green on 2026-06-28, after 07 + 08 + review fixes)

`cd Source/backend`: `npm run test:unit` (**703**), `npm run skill:hexagonal-architecture-validator` (0),
`npm run validate:security` (0), `npx tsc --noEmit` (0). `cd Source/webapp` + `cd Source/admin`:
`npx tsc --noEmit` (0). Integration: `HouseholdCreditCarryover.local.test.ts` (6) green against local
Postgres (conservation verified). `cd Source/infra`: `npx tsc --noEmit` (0). Migration
`…160000_invoice_quota_pooled.ts` still needs to be applied to local/dev/prod (object-owner role) before the
worker charge path is exercised end-to-end. Re-run `cd Source/infra`: `npm test` + `STAGE=dev … npx cdk synth
WobblioBackendStack-dev` (cdk-nag) after applying. Local DB previously migrated through `…150000`; apply
`…160000` next. **06 adds no migration** but needs the 3 size SSM params seeded (manual op #8). Webapp
`upload-receipt.test.ts` (3) updated for the POST contract; `STAGE=dev cdk synth WobblioStorageStack-dev`
+ `WobblioBackendStack-dev` pass cdk-nag (exit 0) after the CORS-POST + IAM path additions. No integration
test for the presigned POST against LocalStack yet (verify the webapp POST flow on first deploy).
**07/08 (final):** backend `npm run test:unit` (**703**), hexagonal (0), `validate:security` (0),
`npx tsc --noEmit` (0); admin `tsc` (0); `WobblioBackendStack-dev` synth (cdk-nag) clean. **Local DB migrated
through `…170000`**; the new 07 integration test `FaultReprocess.local.test.ts` (4) passes against local
Postgres (exercises `admin_blocked_invoices` / reprocess / won't-process). Migrations `…160000`+`…170000` still
need applying to **dev/prod** (object-owner). 08 ships OFF (`DEBUG_SAMPLE_ENABLED` unset).
