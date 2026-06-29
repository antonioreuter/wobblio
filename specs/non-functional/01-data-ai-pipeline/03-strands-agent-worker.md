# 03 — Strands Agent Worker

**Non-Functional 01 · Phase 3/5 · Agentic ingestion worker**

Parent: [../01-data-ai-pipeline.md](../01-data-ai-pipeline.md) §3 · Index: [README](./README.md)

## Overview

The `WobblioAgenticWorkerLambda` handler: a `@strands-agents/sdk` coordinator agent that
transforms raw receipt images into structured financial data by invoking specialized tools.
Each tool wraps an **existing** domain service — the agent orchestrates, it does not
reimplement business logic. The worker preserves every cross-cutting guarantee of the legacy
worker (idempotency, RLS, transaction, DLQ, refund, price emission) and writes telemetry with
`pipeline_type='STRANDS'`.

## Dependencies

- [01 — Ingestion Telemetry](./01-ingestion-telemetry.md) (telemetry write path)
- [02 — Agentic Pipeline Stack](./02-agentic-pipeline-stack.md) (queue + Lambda)
- Reuses (do not duplicate): `VisionParseService`, `MerchantResolver`, `ProductNormalizer`,
  `InvoiceClassifier`, `TagGenerator`, `IInvoiceRepository`, `IPriceObservationStore`,
  `IModelRegistry`/`SsmModelRegistryAdapter`, `IngestionLedgerAdapter`, `TenantContextAdapter`.

## Design

### 1. Worker shell (mirror the legacy worker)

Per-record: `BEGIN` → ledger `claim()` (idempotency, invariant #7) → `SET LOCAL
app.current_tenant_id` before first query → run agent → tenant writes → price emission (tags
**never** emitted) → telemetry insert → `COMMIT`. On failure: `ROLLBACK`,
`reportBatchItemFailures`; on `ApproximateReceiveCount >= 3` flip to `FAILED_PROCESSING` +
guarded refund (reuse the legacy `markInvoiceFailed`/`refundFailedUpload` logic — extract to a
shared module rather than copy-paste).

### 2. Coordinator agent

```typescript
import { Agent } from "@strands-agents/sdk";
const invoiceAgent = new Agent({
  model: await modelRegistry.getModelId('vision_parser'),
  systemPrompt: /* Master Invoice Ingestion Coordinator — parent §3 */,
  outputSchema: ProcessedInvoiceSchema, // Zod
});
```

- `ProcessedInvoiceSchema` (Zod) for structured output; one retry-with-errors before DLQ
  (consistent with the legacy schema-validation contract).
- **Constrained / forced tool order** (OCR → merchant → product → classify → tag) to prevent
  runaway reasoning loops and token blow-up. The agent must not free-choose stage order.
- Arithmetic-balance check (sum of lines vs total) before returning.

### 3. Tools (parent §3) — thin wrappers over domain services

1. **`OCRParserTool`** — file-type detection: PDF → `IModelRegistry.getModelId('pdf_parser')`
   (exclusive, no fallback; the vision model rejects document blocks); image →
   `getModelId('vision_parser')`. Invokes `VisionParseService`.
2. **`MerchantResolverTool`** → `MerchantResolver.resolve`.
3. **`ProductNormalizerTool`** → `ProductNormalizer.normalize` (batch).
4. **`InvoiceClassifierTool`** → `InvoiceClassifier.classify`.
5. **`SearchTagGeneratorTool`** → `TagGenerator.generate` (≤3 tags from SSM vocabulary).

### 4. Telemetry

Write `invoice_telemetry` with `pipeline_type:'STRANDS'`, aggregating token usage across all
tool model calls; emit the `invoice_processed` log. `cost_usd` via the shared
`AiSpendRollupService` pricing source ([01](./01-ingestion-telemetry.md)).

### 5. Strands SDK risk (locked decision #3)

**Verification task first:** confirm `@strands-agents/sdk` runs on Node 24 / Lambda ARM64 with
Bedrock Converse and Zod output schemas. **Fallback:** if the TS SDK is immature, implement a
thin in-house tool-loop orchestrator (deterministic forced-order tool dispatch + schema
validation) behind the same agent interface, so tools/worker shell are unchanged.

## Checklist

- [ ] Worker shell reuses idempotency ledger, RLS tenant context, transaction, DLQ + refund (shared module)
- [ ] Coordinator agent with Zod `ProcessedInvoiceSchema`, forced tool order, arithmetic balance, 1 retry
- [ ] 5 tools wrapping existing domain services (no reimplementation)
- [ ] PDF→`pdf_parser` exclusive, image→`vision_parser` (no fallback)
- [ ] Price emission with no tag parameter
- [ ] Telemetry `pipeline_type='STRANDS'` + `invoice_processed` log
- [ ] Strands SDK verified OR fallback orchestrator behind the agent interface
- [ ] `npm run skill:hexagonal-architecture-validator` exit 0; mocked-port unit tests per tool
