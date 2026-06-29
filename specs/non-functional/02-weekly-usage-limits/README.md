# 02 — Weekly Usage & Credit Limits — Decomposition & Handoff

**Non-Functional | Phase 4-5/5 | Credit-based weekly usage enforcement**

Decomposition of the parent spec [`../02-weekly-usage-limits.md`](../02-weekly-usage-limits.md) into
incrementally shippable sub-specs. The parent states the original intent; **this folder is authoritative
for implementation** where it deliberately overrides the parent (see Locked decisions). Each sub-spec is
ordered by dependency. Mirrors the `01-data-ai-pipeline/` convention (parent + numbered children).

The **living handoff** is [`00-handoff.md`](./00-handoff.md) — update its Build Status table (and the
one below) as each sub-spec lands so work can resume across context resets. Implement one at a time,
clear context between.

## Locked decisions (binding — override the parent spec where they conflict)

1. **Security first — NO `app.bypass_rls`.** The parent §4/§5/§11 "no stored procedures + RLS bypass flag"
   is **rejected**. Isolation stays: RLS on every tenant table + non-owner `NOBYPASSRLS` runtime role +
   narrow **single-statement** `SECURITY DEFINER` primitives for the few cross-tenant ops. SQL functions
   carry **no business logic** (no `IF`/arithmetic/decisions) — that lives in TS (hexagonal invariant #3).
   Admins never read other users' invoice **content** (surface = email/role/credit-usage only).
2. **Charge by timing.** Presign only *checks* (`used < cap`, no write). The worker charges **actual tokens
   whenever the model ran** — incl. the model's own `unreadable` verdict (self-limits bad-photo spam).
   Free only for pre-AI validation rejects and system-faults. `avg_tokens` is **all-model** (vision +
   merchant + product + classifier + Titan embedder) and must be **calibrated from real `bedrock_usage`**.
3. **System-fault = quarantine + reprocess-on-behalf.** Our-crash → don't charge, **lock from deletion**,
   store reason, notify user (friendly, internals-safe). Operator **re-enqueues the stored S3 file** after
   the fix — the user never re-uploads (closes the delete/re-upload farming loop). Successful reprocess
   unblocks + charges the user that run; cross-week reprocess charges the **current** week + emits a
   `reprocess_cross_week` KPI. "Won't-process" escape demotes to a deletable user-fault.
4. **Failure-refund subsystem is deleted** (`UPLOAD_FAILURE_REFUNDS`, `*_failure_refunds_per_week`,
   `getFailureRefundCap`, `refundFailedUpload`) — dead once charging is success-only.
5. **No EMF.** New telemetry (`reprocess_cross_week`, system-fault counts) = plain structured logs +
   `kpi_daily` rollup, consistent with the existing pipeline.

## Sub-specs

| # | Spec | Summary |
|---|------|---------|
| 01 | [Credit Core](./01-credit-core.md) | `CREDITS`/`HOUSEHOLD_CREDITS` enum, cap = `invoice_limit × avg_tokens`, presign check-only, worker token charging, `/me/usage`, admin repoint, refund removal |
| 02 | [UI Copy](./02-ui-copy.md) | webapp + admin-console text/format → credits |
| 03 | [System-Fault Quarantine](./03-system-fault-quarantine.md) | **core only:** charge-by-timing (model-ran gate), model `unreadable` verdict, quarantine columns + worker routing, delete-guard (409), friendly reasons + `invoice_system_fault` notify, refund SSM decommission |
| 04 | [Household Carry-Over](./04-household-carryover.md) | §6.3 mid-week credit carry-over; owns the `/me/usage` pool-only display flip |
| 05 | [Churn Detection](./05-churn-detection.md) | membership-event audit, per-week threshold, hard guard, admin surfacing |
| 06 | [Presign Upload Validation](./06-presign-upload-validation.md) | *carved from 03 §3:* format allow-list (incl. HEIC), per-format size via presigned-POST `content-length-range` **+** worker-start byte/page checks, `isSystemFault` + worker user-fault branch |
| 07 | [Operator Reprocess-on-Behalf](./07-operator-reprocess-on-behalf.md) | *carved from 03 §7–8:* `admin_blocked_invoices`, re-enqueue stored file, charge current week, `reprocess_cross_week` KPI, won't-process escape |
| 08 | [Debug-Sample Endpoint (GDPR)](./08-debug-sample-gdpr.md) | *carved from 03 §8–9:* `sample.zip` opaque-bytes-only debug pull. **SHIP BLOCKER:** DPO/counsel sign-off + ToS clause |

## Build-order dependency graph

```
01 credit core ──┬──> 02 UI copy
                 ├──> 03 system-fault quarantine (core) ──┬──> 06 presign validation
                 │                                         ├──> 07 reprocess-on-behalf
                 │                                         └──> 08 debug-sample (GDPR-blocked)
                 └──> 04 household carry-over ──> 05 churn detection
```

Recommended sequence: **01 → 02 → 03 (core)**, then **06 → 07** (presign validation, then reprocess);
**defer 04 → 05** (churn-gaming) and **08** (needs legal sign-off). 03's core shipped 2026-06-28.

## Build Status (handoff)

| # | Sub-spec | Status | Notes |
|---|----------|--------|-------|
| 01 | Credit Core | Done (2026-06-28) | Credits live; presign check-only + burst guard; worker charges actual tokens. Manual SSM ops pending — see [00-handoff](./00-handoff.md) |
| 02 | UI Copy | Done (2026-06-28) | Credits-first copy + thousands separators; "5 members"→3 (incl. 2 spots beyond spec) |
| 03 | System-Fault Quarantine (core) | Done (2026-06-28) | Charge-by-timing model-ran gate, `unreadable` verdict, quarantine + worker routing, delete-guard 409, `invoice_system_fault` notify, refund SSM decommission. Validation + presign + reprocess + debug-sample carved to 06/07/08 |
| 04 | Household Carry-Over | Done (2026-06-28) | Atomic SD carry-over (copy on activate / GREATEST on settle) wired into accept-invite + leave/removeMember/disband; `/me/usage` flipped to pool-only when pooled. Built ahead of the defer note (full-epic-before-deploy) |
| 05 | Churn Detection | Deferred (recommended) | |
| 06 | Presign Upload Validation | Done (2026-06-28) | +HEIC/WebP allow-list, presigned POST (PUT→POST, webapp flipped), 3 size/page SSM params, worker-start validation, `isSystemFault` user-fault branch + `markFailed`. Coordinate the PUT→POST deploy |
| 07 | Operator Reprocess-on-Behalf | Done (2026-06-28) | 3 SD fns (list/reprocess/won't-process), `AdminFaultService`, `/admin/faults` route + console page, `invoice_reprocessed` notify, cross-week KPI rollup (4th in the metrics cron), `max_system_faults_per_week` alert |
| 08 | Debug-Sample Endpoint (GDPR) | Built — ship-blocked (legal) (2026-06-28) | `sample.zip` built **default-OFF** (`DEBUG_SAMPLE_ENABLED`): ≤2/root-cause, opaque bytes only (server-side fetch, no key/path/owner leak), audited (actor+reason+count, never tenant), nothing persisted. **DPO/counsel sign-off + gdpr-officer review + ToS clause still required before enabling.** |

## Open product decisions (carried from the plan — not blocking 01's structure)

1. **Calibrate `avg_tokens` from real data before launch** (highest value; de-risks €3 pricing).
2. Burst-overrun strictness — recommend in-flight `PROCESSING × avg_tokens` projection at the check.
3. Cutover backfill — recommend accept the one-time reset (no backfill).
4. `used` UX lag — folds into #2 if the projection is adopted.
5. Scans-first display ("≈7 of 10 scans left" primary, credits secondary).
6. Standard (free-tier) cap = biggest cost line — size deliberately.

## House DoD (applies to every backend sub-spec)

- `cd Source/backend && npm run skill:hexagonal-architecture-validator` — exit 0.
- `cd Source/backend && npm run test:unit` — mocked ports, 100% domain coverage.
- `cd Source/backend && npm run validate:security` — on any DDL/adapter change.
- `cdk synth` passes `cdk-nag`.
- Worker changes: per-stage telemetry still emitted; idempotency + RLS intact.
- Tenant-isolation precondition (before launch): confirm **prod** runtime role is `NOBYPASSRLS` + not owner.
