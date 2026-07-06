# 07.01 — Processing progress backend

**Goal:** while an invoice is `PROCESSING`, expose *which* stage it is in so clients can render
honest, stage-accurate progress; give clients a cheap endpoint to poll it.

## User-visible stage model

Four coarse stages, mapped from the pipeline (avg budget from the 00-handoff baseline):

| `processing_stage` | Set when | Typical duration | Client copy |
|---|---|---|---|
| `RECEIVED` | at presign-confirm (row creation default) | ~1.3s queue wait | "Received — starting…" |
| `READING` | worker starts vision parse (ExtractionPreparer, before the OCR tool call) | ~10s | "Reading your receipt…" |
| `MATCHING` | InvoiceCoordinator starts MERCHANT_RESOLUTION | ~5s | "Matching products & prices…" |
| `FINALIZING` | InvoiceCoordinator completes TAG_GENERATION / finalizer entry | <1s | "Finishing up…" |

Terminal statuses (`PARSED`, `NEEDS_REVIEW`, `FAILED_PROCESSING`, quarantine, duplicate) make the
stage irrelevant — clients stop rendering it the moment `status` leaves `PROCESSING`. Do NOT add
per-tool granularity (classification/tags are ~0ms; more stages = flicker, not information).

## Storage

New migration: `invoice_processing_progress`

```
invoice_id   uuid PK REFERENCES invoice(id) ON DELETE CASCADE
tenant_id    uuid NOT NULL            -- RLS scope, same policy pattern as invoice
stage        text NOT NULL CHECK (stage IN ('RECEIVED','READING','MATCHING','FINALIZING'))
updated_at   timestamptz NOT NULL DEFAULT now()
```

- RLS enabled, tenant policy identical to `invoice` (household-space rows follow the invoice's
  tenant stamping — copy the invoice row's tenant, don't re-derive).
- `ON DELETE CASCADE` keeps the GDPR delete path and normal invoice deletes clean; still verify
  the Epic-13 cascade inventory mentions it, and run `npm run validate:security`.
- No retention job needed: one tiny row per invoice, removed with its invoice. (If preferred,
  the finalizer's terminal UPDATE may `DELETE` the row in the main transaction — optional.)

Why not a column on `invoice`: the unified worker transaction UPDATEs the invoice row at finalize
and holds that row lock until COMMIT; progress writes to the same row can block/serialize behind
it. A separate row has zero contention with the pipeline.

## Ports & services (hexagonal)

- `src/core/ports/ingestion/IProcessingProgress.ts`:
  `recordStage(invoiceId: string, stage: ProcessingStage): Promise<void>` — contract: **never
  throws, never blocks the pipeline outcome** (same never-throw contract as
  `IAgenticStageInstrumentation`; the coordinator already guards defensively — mirror that).
- Domain: `ProcessingStage` union in `src/core/domain/` (near `agenticStage.ts`).
- Adapter `src/infrastructure/adapters/ingestion/ProcessingProgressAdapter.ts`: takes the worker
  `Pool` (NOT the per-record `client` — that one is inside the long transaction). Each write is its
  own short transaction: `BEGIN; SET LOCAL app.current_tenant_id=…; INSERT … ON CONFLICT (invoice_id)
  DO UPDATE SET stage=…, updated_at=now(); COMMIT`, swallow-and-log on failure.
- **Connection budget:** worker pool is max:1 today. Raise the *worker* pool to max:2 (progress
  connection is only held for milliseconds per write, 3 writes per invoice). Worst case becomes
  +5 connections (SQS maxConcurrency 5) — new ceiling ~37 of the ~85 t3.micro budget documented in
  backend CLAUDE.md; update that doc line. Do not touch API/cron pools.
- Wire-up: hand `IProcessingProgress` to `ExtractionPreparer` (flip to `READING` before the OCR
  tool call) and `InvoiceCoordinator` (flip to `MATCHING` before the merchant stage, `FINALIZING`
  after the tag stage). `RECEIVED` is the column default at row insert — PresignService/confirm
  writes it implicitly via the invoice INSERT trigger point, i.e. insert the progress row in
  ConfirmService when the invoice is enqueued (inside its existing transaction, same client —
  that one is fine, it commits immediately).

## API

Extend, don't multiply:

1. `GET /invoices` (list): join the progress row; add `processingStage` to items whose status is
   `PROCESSING` (null otherwise). One LEFT JOIN, RLS-safe.
2. New lightweight `GET /invoices/status?ids=<uuid,uuid,…>` (cap 10 ids): returns
   `[{ id, status, processingStage, updatedAt }]`. Single indexed RLS query, no lines/join bloat —
   this is what clients poll every ~2s instead of re-fetching the full list. Cognito-authorized
   like every invoice route; ids not owned by the tenant are simply absent from the response
   (RLS does this for free — no 403 oracle).

## Out of scope

- No push/WebSocket/SSE (00-handoff decision of record).
- No stage rendering — that's 02 (webapp) and 03 (mobile).
- Do not extend `buildIngestionPush` — push remains terminal-status-only.

## Acceptance

- Upload a receipt on dev → `invoice_processing_progress.stage` observably walks
  RECEIVED → READING → MATCHING → FINALIZING (query between stages or assert via status endpoint
  polling in an integration test).
- Kill the progress adapter (e.g. mock it to throw) → ingestion outcome unchanged, unit test
  proves the pipeline ignores progress failures.
- `GET /invoices/status` for another tenant's invoice id returns an empty entry, not data (RLS
  integration test).
- Gates: hexagonal validator exit 0 · `test:unit` (coordinator/preparer stage flips with mocked
  port; never-throw guard) · `validate:security` (new DDL) · `cdk synth` if any CDK change (none
  expected — same worker Lambda, same API handler).
