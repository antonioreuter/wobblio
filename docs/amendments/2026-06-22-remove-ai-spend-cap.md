# Spec amendment — Remove the AI daily-spend cap and ai_spend_ledger

**Date:** 2026-06-22
**Status:** adopted
**Amends:** §2.4 (quotas), §6 ingestion pipeline (AI spend guard), §7.x telemetry
**Branch:** `fix/merchant-resolution-and-branch-removal`

## What changed

The per-tenant daily AI-spend cap (`BedrockSpendGuardService` + `ai_spend_ledger` +
SSM `/wobblio/config/ai/daily_spend_cap`) is **removed**. The business control for AI cost is
the **weekly invoice quota** (§2.4), already enforced in one place
(`QuotaService.reserveUpload`, invariant #6).

## Why

- The cap was a **single global SSM value**. Raising it to unblock one legitimate tenant
  raised it for every tenant — it could not be tuned per customer, so it was the wrong knob.
- When it fired it failed **silently**: the Bedrock call threw, the invoice was retried 3×
  and sent to the DLQ, left stuck in PROCESSING with no message to the user — bad UX for a
  limit the customer cannot see.
- The product is billed on **invoices scanned**, not AI usage. The invoice quota already
  bounds how much work (and therefore AI cost) a tenant can drive per week.
- The ledger only ever read **today's** total for the cap check; all historical rows were
  dead weight on an ever-growing table.

## Replacement

- **No replacement cap.** Quota is the sole upload control.
- **Abuse visibility via logs.** When an upload is rejected for hitting the weekly quota, the
  API handler emits a structured `event: quota_block` log (tenant, quota type, used, cap,
  week). Frequency in CloudWatch surfaces repeat abusers. If abuse becomes material, a
  smarter mechanism can be designed then.

## Telemetry is unaffected

Per-call token usage is logged by `BedrockConverseAdapter` (`event: bedrock_usage`),
independent of the ledger, and rolled into `kpi_daily`. Removing the ledger loses no AI-cost
visibility.

## Mechanical impact

- Deleted: `BedrockSpendGuardService`, `IAiSpendLedger`, `IAiSpendCapProvider`,
  `AiSpendLedgerAdapter`, `SsmSpendCapAdapter`, `AiSpendCapExceededError`.
- The four AI callers (`VisionParseService`, `MerchantResolver`, `ProductNormalizer`,
  `InvoiceClassifier`) now depend on `IBedrockConverse` directly; the `tenantId` parameter
  they carried solely to feed the cap is dropped from their methods and ports.
- `ai_spend_ledger` table dropped (migration).
- `/wobblio/config/ai/daily_spend_cap` removed from bootstrap/seed/config.
