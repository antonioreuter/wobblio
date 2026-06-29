# 04 — Dynamic Queue Routing

**Non-Functional 01 · Phase 3/5 · Confirm-time pipeline selection**

Parent: [../01-data-ai-pipeline.md](../01-data-ai-pipeline.md) §1 · Index: [README](./README.md)

## Overview

Route a confirmed invoice to either the legacy or the agentic queue based on the SSM feature
flag `/wobblio/config/features/agentic_pipeline_enabled`, abstracted behind a new domain port so
the API stays unaware of pipeline internals. Ships safely before the agentic worker is live:
the flag defaults to `false` (→ legacy).

## Dependencies

- [02 — Agentic Pipeline Stack](./02-agentic-pipeline-stack.md) (agentic queue URL to route to)
- Reuses: `ConfirmService.ts`, `handleConfirm` (api-handler/index.ts:590), warm-container SSM
  caching pattern from `SsmModelRegistryAdapter`.

## Design

### 1. New port (locked decision #1 — as written in the parent spec)

```typescript
// Source/backend/src/core/ports/ingestion/IInvoiceIngestionQueuePort.ts
export interface IInvoiceIngestionQueuePort {
  enqueue(invoiceId: string, tenantId: string, s3Key: string): Promise<void>;
}
```

Created alongside the existing `IIngestionQueue` (not merged).

### 2. Adapter — `SqsInvoiceIngestionQueueAdapter`

- Reads `agentic_pipeline_enabled` from SSM with a **warm-container TTL cache** — confirm is the
  hot api-handler path (5s statement timeout, ≤25 concurrency); a per-request SSM call risks
  latency/throttling. Match the `SsmModelRegistryAdapter` caching approach.
- `true` → enqueue to the agentic queue URL; `false` → legacy queue URL.
- **Fail-safe:** on SSM read error / missing param, route to **legacy** (never drop the message).

### 3. Confirm rewire

`ConfirmService` / `handleConfirm` depend on `IInvoiceIngestionQueuePort`. Both queue URLs are
provided via env (`INGEST_QUEUE_URL` legacy + agentic URL from [02](./02-agentic-pipeline-stack.md)).
Confirm-time validation (invoice exists, S3 object present, PDF ≤4.5MB) is unchanged.

## Checklist

- [x] `IInvoiceIngestionQueuePort` port created (parallel to `IIngestionQueue`)
- [x] `SqsInvoiceIngestionQueueAdapter` with TTL-cached SSM flag read + dual-queue routing
- [x] Fail-safe to legacy on SSM miss/error
- [x] `handleConfirm`/`ConfirmService` rewired; legacy URL in env + agentic URL from SSM (see handoff note)
- [x] Unit tests: flag on → agentic, flag off → legacy, SSM error → legacy (spy on SSM/SQS clients)
- [x] `npm run skill:hexagonal-architecture-validator` exit 0
