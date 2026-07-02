# 07a — Ingestion Spec Realignment (doc-only)

**Parent:** [07 — Core Ingestion Pipeline](../07-core-ingestion-pipeline.md) · **Priority: P3
(spec contradictions that will misdirect future work on the product's core path)** ·
**Tags:** [DRIFT] [CONTRADICTION] · **DB migration:** none · **Code change:** none

## Findings in the parent spec

1. **`07:81` "Per-stage CloudWatch metrics (duration, tokens, cost) via EMF"** — EMF was
   deliberately removed 2026-06-21 (cost, unused). Telemetry is structured logs
   (`bedrock_usage`, `ingestion timing`) + nightly Logs Insights rollup into `kpi_daily`
   (`cron-ingestion-metrics-rollup`). `Source/backend/CLAUDE.md` already states this; the epic spec
   contradicts it. Do **not** re-add EMF.
2. **`07:82` "Per-tenant daily AI spend cap enforced (SSM parameter, `ai_spend_ledger` write)"** —
   `ai_spend_ledger` was dropped (migration `20260622130000_drop_ai_spend_ledger.ts`); spend is
   bounded by the **credit quota** (`specs/non-functional/02-weekly-usage-limits/`), not a daily cap.
3. **`07:72`/`07:141` "Confirmed duplicates … do not consume quota / quota refunded"** —
   NF-02's locked charge-by-timing decision reverses this: the worker charges whenever the model
   ran, **including** `SUSPECTED_DUPLICATE` (fuzzy dupes are detected *after* parse). Refund
   machinery was decommissioned (refund SSM removed). Exact-hash dupes still cost zero (rejected at
   confirm, pre-AI).
4. **`07:42-48` status machine is incomplete** — missing states/transitions that shipped:
   system-fault **quarantine** (`invoice_fault_quarantine` migration, `InvoiceBlockedError` 409,
   reprocess-on-behalf), the stuck-`PROCESSING` **reaper** (`fail_stuck_invoices_fn`,
   `0669a8f8`), deleted-reupload → normal `PARSED` + `price_emission_blocked` (not
   SUSPECTED_DUPLICATE), and user **correction** (`PUT /invoices/{id}`, `corrected_at`, built in
   16e because 07/08 never had it).
5. **`07:126` multi-page receipt support** — checklist item with no implementation (presign issues
   exactly one object per invoice). Either delete the item or move it to a real backlog spec;
   silence is currently read as "shipped".
6. **Quota wording throughout** is invoice-count based; superseded by credits (NF-02).

## Proposed fix

Edit `07-core-ingestion-pipeline.md` in place: replace the EMF/ledger lines with the
logs→`kpi_daily` reality, restate dedup charging per NF-02, extend the state machine, tick the
checklist items that verifiably shipped, and strike or re-home multi-page support. Add a
"Superseded by" banner pointing to `specs/non-functional/01-data-ai-pipeline/` (agentic pipeline +
dynamic queue routing) and `02-weekly-usage-limits/` for the subsystems those now own.
