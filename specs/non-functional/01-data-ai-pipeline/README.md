# 01 — Agentic Ingestion Pipeline — Decomposition & Handoff

**Non-Functional | Phase 3/5 | Parallel Agentic Invoice Ingest Workflow**

Decomposition of the parent spec [`../01-data-ai-pipeline.md`](../01-data-ai-pipeline.md) into
incrementally shippable sub-specs. The parent remains authoritative for intent; this folder is
the implementation-ready breakdown. Each sub-spec is independently deployable and ordered by
dependency. Mirrors the `specs/mvp/admin-console/` convention (parent + numbered children).

This file doubles as the **living handoff**: update the Build Status table as each sub-spec
lands so work can resume across context resets. Implement one at a time.

## Locked decisions (binding for all sub-specs)

1. **Routing port:** create the new `IInvoiceIngestionQueuePort` *as written in the parent
   spec*. Do **not** collapse it into the existing `IIngestionQueue`.
2. **`invoice_telemetry` visibility:** RLS for tenant self-reads (invariant #1) **plus** a
   `SECURITY DEFINER` function for cross-tenant operator cost analysis — the
   `admin_business_kpis` pattern. The raw cross-tenant `SELECT` in the parent §5 is replaced by
   that function.
3. **Strands SDK:** mandate `@strands-agents/sdk`, but include a verification task and a
   documented fallback (thin in-house tool-loop orchestrator behind the same agent interface)
   if the TypeScript SDK is not Node-24/Lambda-ready.
4. **No EMF:** telemetry is plain structured logs + `kpi_daily` rollup, consistent with the
   existing pipeline. Do not add CloudWatch EMF custom metrics.

## Sub-specs

| # | Spec | Summary |
|---|------|---------|
| 01 | [Ingestion Telemetry](./01-ingestion-telemetry.md) | `invoice_telemetry` table, RLS + SECURITY DEFINER cost fn, GDPR cascade, write path, `cost_usd` |
| 02 | [Agentic Pipeline Stack](./02-agentic-pipeline-stack.md) | `WobblioAgenticPipelineStack`: SQS+DLQ, worker Lambda, IAM, cross-stack wiring |
| 03 | [Strands Agent Worker](./03-strands-agent-worker.md) | Coordinator agent + 5 tools wrapping domain services; Zod schemas; idempotency/RLS reuse |
| 04 | [Dynamic Queue Routing](./04-dynamic-queue-routing.md) | `IInvoiceIngestionQueuePort` + dual-queue adapter; SSM feature flag (cached); confirm rewire |
| 05 | [Admin Pipeline Toggle](./05-admin-pipeline-toggle.md) | `POST /admin/features/toggle`, audit log, `/admin/pipeline-toggles` UI |
| 06 | [KPI Pipeline Comparison](./06-kpi-pipeline-comparison.md) | `pipeline_type` rollup dimension + admin comparison dashboard tab |
| 07 | [Pipeline Evaluation Harness](./07-pipeline-evaluation-harness.md) | `scripts/evaluate-pipelines.ts` + LLM-as-a-judge offline comparison |

## Build-order dependency graph

```
01 telemetry ─────────────┐
                          ├──> 06 KPI comparison
02 agentic stack ──┐      │
                   ├──> 03 strands worker ──> 07 eval harness
                   └──> 04 routing ──> 05 admin toggle
```

Recommended sequence: **01 → 02 → 03 → 04 → 05 → 06 → 07**. 01 and 02 are parallelizable;
04 ships safely before 03 lands because the feature flag defaults to `false` (routes to legacy).

## Build Status (handoff)

| # | Sub-spec | Status | Notes |
|---|----------|--------|-------|
| 01 | Ingestion Telemetry | **Done (2026-06-29)** | Legacy producer shipped. See [00-handoff.md](./00-handoff.md) |
| 02 | Agentic Pipeline Stack | **Done (2026-06-29)** | Stack + skeleton worker shipped (synth/nag green). See [00-handoff.md](./00-handoff.md) |
| 03 | Strands Agent Worker | Not started | Confirm `@strands-agents/sdk` Node-24 readiness first |
| 04 | Dynamic Queue Routing | Not started | Flag defaults false → legacy |
| 05 | Admin Pipeline Toggle | Not started | |
| 06 | KPI Pipeline Comparison | Not started | |
| 07 | Pipeline Evaluation Harness | Not started | Needs reusable dry-run processor from 03 |

## House DoD (applies to every backend sub-spec)

- `cd Source/backend && npm run skill:hexagonal-architecture-validator` — exit 0.
- `cd Source/backend && npm run test:unit` — mocked ports, domain coverage.
- `cd Source/backend && npm run validate:security` — on any DDL/adapter change.
- `cdk synth` passes `cdk-nag`.
- Worker changes: per-stage telemetry still emitted; idempotency + RLS intact.
