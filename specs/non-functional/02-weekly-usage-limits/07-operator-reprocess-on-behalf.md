# 07 — Operator Reprocess-on-Behalf

**Non-Functional 02 · carved out of [03](./03-system-fault-quarantine.md) §7–§8 · deferred from the 2026-06-28 core pass**

Parent: [../02-weekly-usage-limits.md](../02-weekly-usage-limits.md) §3 · Index: [README](./README.md)

## Why this is its own sub-spec

03's core pass quarantines a system-fault invoice (`system_fault_reason` + `blocked_at`), holds it from
deletion (409), and notifies the owner. What it does **not** yet do is let an operator fix the root cause
and re-run the invoice **on the user's behalf** from the retained S3 file. That's this sub-spec. It
depends only on 03's core (the quarantine columns + delete-guard already exist).

## Design

### 1. Surface the quarantine (admin, metadata-only)
Thin `SECURITY DEFINER`, admin-route gated, audited (mirror the 03/01 SD-fn pattern; owned by the
table-owner role so it can read cross-tenant):
- `admin_blocked_invoices()` → `(invoice_id, owner_id, system_fault_reason, image_s3_key, blocked_at)`.
  Metadata only — never invoice **content** (Locked decision #1).

### 2. Reprocess
Operator batch action over selected blocked invoices:
1. **Release the ledger claim** (reuse `IIngestionLedger.release(s3Key)` — the same release
   `DeleteInvoiceService` uses) so the content-addressed key can be re-claimed.
2. Set the invoice back to `PROCESSING` and clear `system_fault_reason` / `blocked_at` (it's no longer
   quarantined while in flight).
3. **Re-enqueue the stored S3 file** to the ingestion queue (`{invoiceId, tenantId, s3Key}`). The user
   never re-uploads — this closes the delete/re-upload farming loop.
- **Success** → the normal worker path unblocks it to `PARSED`/`NEEDS_REVIEW`, **charges the user the
  run's tokens** (charge-by-timing already does this), and notifies (`kind: 'invoice_reprocessed'`,
  friendly copy).
- **Cross-week:** charge the **current** week (the worker already charges the current week), and emit a
  `reprocess_cross_week` structured log → rolled into `kpi_daily` (see §4).
- **Re-failure:** if it faults again, it re-quarantines (idempotent `quarantine` guard) — back in the list.

### 3. "Won't-process" escape
Operator action that demotes a blocked invoice to a **deletable user-fault**: clear `system_fault_reason`
(and `blocked_at`), keep `FAILED_PROCESSING` + a `failure_reason_code`, optionally notify. Used when the
image genuinely can't be processed and shouldn't be reprocessed.

### 4. Per-week threshold = alert-only
`max_system_faults_per_week` (SSM) drives an **alert only** — the delete-lock already prevents farming, so
no hard guard. Emit a count metric; surface on the admin ops view.

### 5. Cross-week KPI rollup
Follow the existing `kpi_daily` pattern (`CloudWatchLogsTimingSourceAdapter` + a rollup service):
- Worker (or reprocess handler) emits `log.info('reprocess cross week', { invoiceId, tokens, originalWeek, chargedWeek })`.
- New source adapter runs a Logs Insights query (`filter msg = "reprocess cross week" | stats count(*), sum(tokens) by chargedWeek`).
- New rollup service writes `kpi_daily` rows (`metric_name: 'reprocess_cross_week_count'`, `dimensions: { week }`).
- Register it as a fourth rollup in `cron-ingestion-metrics-rollup` (alongside timing/business/ai_spend).
- **No EMF** (Locked decision #5).

### 6. Admin route
`/admin/faults` under `handleAdminRoute` (role-gated `ADMIN`, audited via `AdminAuditLogAdapter`):
list (calls `admin_blocked_invoices`), reprocess (batch), won't-process. Action strings e.g.
`fault.reprocess`, `fault.wont_process`.

## Checklist
- [ ] `admin_blocked_invoices()` SD fn (incl. `image_s3_key`), owner-role applied
- [ ] Reprocess: ledger release + status→PROCESSING + clear quarantine + SQS re-enqueue of stored file
- [ ] Success → unblock + charge current week + `invoice_reprocessed` notify; cross-week → `reprocess_cross_week` log
- [ ] Won't-process demotion to deletable user-fault
- [ ] `max_system_faults_per_week` alert-only metric
- [ ] `reprocess_cross_week` source adapter + rollup service + cron registration → `kpi_daily`
- [ ] `/admin/faults` route: list / reprocess / won't-process, role-gated + audited
- [ ] `validate:security` green; unit + integration tests per parent §8
