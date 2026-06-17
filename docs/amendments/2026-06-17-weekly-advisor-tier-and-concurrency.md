# Spec amendment — Weekly AI advisor: model tier + execution shape

**Date:** 2026-06-17
**Status:** adopted
**Amends:** §B.5 (Weekly AI savings advisor), Appendix B model-assignment table, §10 (EventBridge crons)
**Branch:** `fix/ingestion-pipeline-iam-and-robustness`

## What changed

### 1. Model tier: `insight` → `auxiliary`

The spec (§B.5 and the Appendix B model-assignment table) assigns the weekly advisor to
the **`insight`** role (Sonnet-class), justified by "customer-facing prose where tone
errors cost trust" and "weekly-per-premium volume makes the unit cost irrelevant."

The advisor now resolves **`/wobblio/config/models/auxiliary`** (Haiku-class) instead.

**Rationale.** The advisor prompt is heavily constrained: it consumes only a small,
pre-aggregated `<facts>` XML document (no raw receipts), is capped at 120 words / 300
output tokens, temperature 0.4, and forbids any reasoning beyond restating supplied
numbers. This is squarely an auxiliary-tier extraction/summarisation task, not open-ended
generation. Moving to the Haiku-class tier roughly halves token cost with no meaningful
quality risk for this prompt shape. The model id remains an opaque, hot-swappable SSM
value, so this can be reverted by pointing the cron back at `…/models/insight` without a
code change (the swap-comparison flow via `prompt_version` still applies).

The Appendix B table row for B.5 should read role `auxiliary` (Haiku-class).

### 2. Execution: sequential loop → bounded concurrency

The original implementation iterated eligible tenants sequentially in a single cron
Lambda, which risked the 30s timeout and produced silent partial completions as the
cohort grew. The cron now fans out one Bedrock call per eligible tenant through a
**bounded promise pool (`MAX_CONCURRENCY = 8`)**, and the Lambda timeout is raised to a
**300s safety net** (`makeLambda(..., timeoutSeconds)`). Per-tenant failures remain
isolated (a single tenant's error never aborts the cohort). Single-tenant isolation and
the `<facts>`-only prompt are unchanged, so tenant data boundaries are intact.

### 3. Batch Inference — deferred, not adopted

The reviewed plan proposed re-architecting onto **Bedrock Batch Inference**
(`CreateModelInvocationJob`). Verification (2026-06-17) found a hard **≥100-record
minimum** per job (some models effectively ≥1,000). Against the enforced capacity
envelope (~10k registered, ~4k MAU, premium a fraction of that), a single weekly run of
PREMIUM + ACTIVE + invoiced-this-week tenants will not reach 100 for the foreseeable
future, so a batch-primary design would never fire. Batch is therefore **deferred** until
the eligible cohort approaches that floor. The bounded-concurrency on-demand path above is
the primary (and currently only) path. The deferred design is captured in
`docs/deferred/weekly-advisor-batch-inference.md`.

## Invariants unaffected

Tenant isolation (one single-tenant prompt per record), prompt-injection mitigations
(`<facts>` XML separators, all values escaped), `prompt_version` recording, and the
"model ids are opaque SSM values" rule all hold.
