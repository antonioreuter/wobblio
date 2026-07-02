# Fix 03 — [ADMIN] Missing Operator Incident Workflows

**Priority: P3 (operator tooling; today these paths require psql/CloudWatch console access, which
the on-call may not have and which bypasses the audit log)** · **Tag:** [GAP] [ADMIN] ·
**DB migration:** none expected (read paths over existing tables; if any new SECURITY DEFINER
read primitive is needed, keep it single-statement per the no-RLS-bypass decision and re-run
`validate:security`).

Grounding: the console already has waitlist, DLQ (full list/inspect/replay/delete + bulk, audited),
alias curation, model matrix, SSM config editor (audited writes), AI-spend + KPI dashboards,
faults (quarantine list/reprocess/debug-sample), pipeline toggles, and troubleshooting (queue
health, log level, live logs; agentic stage-health in flight). The gaps below are what an on-call
still cannot do from the console.

## A. Single-invoice pipeline drill-down ("where is invoice X stuck?")

The #1 incident question has no view. Data exists: `invoice.status`, `ingestion_ledger`,
`invoice_telemetry` (per-stage timing/tokens/model), worker logs. Add
`GET /admin/troubleshooting/invoice/{id}` returning status + ledger claim + per-stage telemetry
timeline (**metadata only — never merchant/lines/image**, per the admins-never-see-content
decision; the id arrives from a user support ticket). UI: lookup box on the troubleshooting page.

## B. Stuck-PROCESSING triage view + manual reaper trigger

A reaper cron fails stuck invoices (`fail_stuck_invoices_fn`), but an operator can't see the
currently-stuck set or trigger the sweep during an incident (e.g. after an SQS outage). Add:
count + age histogram of `PROCESSING` older than threshold (aggregate, cross-tenant-safe — counts
only), and an audited "run reaper now" action invoking the existing function.

## C. Runaway-spend guard: intraday view + kill-switch proximity

AI-spend dashboard reads `kpi_daily` — **nightly** rollup, so a runaway loop burns money for up to
24h unseen. Add an intraday panel querying `bedrock_usage` logs via Logs Insights for the last N
hours (same mechanism the queue-health/stage-health panels already use), with the existing
pipeline toggle (agentic on/off) and model matrix linked from the same card ("see spike → flip
switch" in one screen). Wire `admin_pipeline_cost_deficit` here or drop it
(see `specs/non-functional/01-data-ai-pipeline/08-pdf-cost-truth.md`).

## D. Catalog-limbo view (Sybil-gate stuck entities)

Curation covers the queue of *submitted* decisions; nothing surfaces PROVISIONAL products/merchants
that have sat below the quorum for weeks (invisible to everyone, quietly rotting). Add a
"stale PROVISIONAL" list (age, observation count, distinct-contributor count — aggregates only)
with the existing approve/merge/reject actions attached. This is also the only lever when a
legitimate product is stuck because k<3 in a thin region.

## E. GDPR ops panel (once 14 lands)

14b's export queue/DLQ and 14c/d's deletion pipeline will need: pending/failed export requests
(request-id, age, status — no content), export DLQ depth, and upcoming purge count. Fold into
troubleshooting; spec it inside `specs/mvp/14-gdpr-data-lifecycle/` when 14c/d are built.

## Boundary (applies to all of the above)

Verified in Phase 1 and must stay true: no admin view returns another user's invoice content
(lines, merchant, image). The one deliberate exception, the debug-sample zip, stays behind
`DEBUG_SAMPLE_ENABLED` pending DPO sign-off (`adminFaultRoutes.ts:37-40`) — nothing in this spec
weakens that gate.
