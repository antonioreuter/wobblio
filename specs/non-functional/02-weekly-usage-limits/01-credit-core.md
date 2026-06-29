# 01 — Credit Core

**Non-Functional 02 · Phase 4/5 · Quota in credits (LLM tokens)**

Parent: [../02-weekly-usage-limits.md](../02-weekly-usage-limits.md) · Index: [README](./README.md)

## Overview

Migrate the weekly quota from **invoice-count** (`UPLOADS`/`HOUSEHOLD_UPLOADS`) to **credits**
(1 credit = 1 LLM token). Cap = `invoice_limit × avg_tokens_per_invoice`. Charging moves from presign-time
(reserve 1) to worker-time (actual tokens, only when the model ran). Soft-Cap-with-Hard-Block preserved.

## Dependencies

- None new. Reuses `quota_counter`, `QuotaService`, `UploadAllowanceResolver`, `SsmUploadQuotaAdapter`,
  `quotaConfig.ts`, `IngestionService`, `ingestion-worker`, `/me/usage`.

## Design

### 1. Enum migration (its OWN file)

`ALTER TYPE quota_counter_type ADD VALUE IF NOT EXISTS 'CREDITS'` + `'HOUSEHOLD_CREDITS'`. Leave the old
values in place (PG can't drop enum values; harmless). **Must be a standalone migration** — PG forbids using
a new enum value in the same tx that added it, and node-pg-migrate wraps each file in a tx.

### 2. Cap derivation (`SsmUploadQuotaAdapter` + `quotaConfig.ts`)

- New SSM `/wobblio/config/quotas/average_tokens_per_invoice`.
- `getPersonalUploadsCap`/`getHouseholdUploadsCap` return `invoice_limit × avg_tokens` — map `-1 → Infinity`
  **before** multiplying. Keep `*_uploads_per_week` as invoice limits; update `household_uploads_per_week`
  seed 20→15 (manual SSM). `effectiveHouseholdCap` unchanged.
- `avg_tokens` is **all-model** (vision + merchant + product + classifier + Titan embedder). The legacy 10k
  was never derived — **calibrate** from real `bedrock_usage` (per-stage, summed per `invoiceId`, p50/p75).
  1 token = 1 credit is a *usage* proxy, not a *cost* proxy.

### 3. Port + adapter (`IQuotaRepository`, `QuotaRepositoryAdapter`)

`QuotaType = 'CREDITS' | 'HOUSEHOLD_CREDITS'`. `increment`/`decrement` take `amount: number` (today +1).
Adapter SQL uses `used = used + $amount` (keep atomic, server-side).

### 4. `QuotaService` — split the conflated `reserveUpload`

- `checkAvailability(owner, type, cap, now): Promise<boolean>` — read-only `used < cap`, **no write**.
- `charge(owner, type, weekStart, amount)` — worker post-success.

### 5. `PresignService` — check only

Replace `reserveUpload(...)` with the read-only assert (throw `QuotaExceededError`). No increment at
presign. **Burst guard:** count in-flight `PROCESSING × avg_tokens` toward the check (pessimistic
projection; reconciled at charge). [Open decision #2 — recommended.]

### 6. Token accumulation → worker charge

- `llmJson.ts` `callJsonWithRetry`: return `BedrockConverseResult` tokens (currently discarded).
- `IngestionService`: accumulate `inputTokens + outputTokens` across **all** stages incl. the Titan
  embedder (`BedrockTitanEmbedderAdapter` — confirm it surfaces an input-token count; small adapter change
  if not). Add `tokens` to `IngestionOutcome`.
- `ingestion-worker`: charge **only** when `outcome.handled === true` (ledger ON-CONFLICT short-circuit =
  double-charge guard) **and** `outcome.status ∈ CHARGED_STATUSES = { PARSED, NEEDS_REVIEW }` (+ the
  `unreadable` verdict from 03; `DISCARDED` charges, post-parse fuzzy duplicate charges). Resolve allowance
  like presign; `quotaService.charge(quotaOwnerId, creditType, weekStart, input+output)`;
  `creditType = householdId ? 'HOUSEHOLD_CREDITS' : 'CREDITS'`. Inside the committed tenant tx.

### 7. `/me/usage`

Read `CREDITS`/`HOUSEHOLD_CREDITS`; **keep today's `personalUsed + poolUsed` sum** (just credit counters).
The pool-only display flip is **04's** job (coupled with carry-over) — do NOT flip here, or a member's
pre-pool usage is hidden and grants free headroom.

### 8. Admin quota repoint (keep SECURITY DEFINER)

Separate migration (after the enum file): `admin_personal_upload_used`/`admin_grant_personal_uploads` read/
write `counter = 'CREDITS'`. UI delta ±10000 (lands in 02). `adminQuotaRoutes.ts` cap = credit cap. Surface
stays email/role/credit-usage — no invoice access.

### 9. Failure-refund neutralization (HERE, not 03 — sequencing)

Delete the `refundFailedUpload` call from `markInvoiceFailed`. Once charging is success-only, refunding a
counter the failure never incremented drives `used` toward 0 wrongly. SSM `*_failure_refunds_per_week`
decommission can ride with 03.

## Checklist

- [ ] Enum migration (standalone) adds `CREDITS`/`HOUSEHOLD_CREDITS`
- [ ] SSM `average_tokens_per_invoice`; provider returns `invoice_limit × avg_tokens`; household seed 20→15
- [ ] `IQuotaRepository.QuotaType` = credits; `increment/decrement(amount)`; adapter atomic `+ amount`
- [ ] `QuotaService.checkAvailability` (read-only) + `charge`; `PresignService` no longer increments
- [ ] Burst projection at the check (in-flight `PROCESSING × avg_tokens`) — per open decision #2
- [ ] `llmJson` returns tokens; `IngestionService` accumulates all-stage tokens incl. embedder
- [ ] Worker charges actual tokens gated on `handled && status ∈ CHARGED_STATUSES`
- [ ] `/me/usage` reads credit counters, KEEPS sum logic (pool-only deferred to 04)
- [ ] Admin repoint migration (separate, later) → `CREDITS`
- [ ] `refundFailedUpload` call removed from `markInvoiceFailed`
- [ ] `validate:security` green; mocked-port unit tests (boundary, "one last over cap", calibration, charge gating)
