# 00 — Living Handoff · Non-Functional 01 (Agentic Ingestion Pipeline)

Running status of the epic so work resumes cleanly across context resets. Update this file as
each sub-spec lands. The [README](./README.md) Build Status table is the one-line index; this is
the detail.

| Sub-spec | Status | Landed |
|---|---|---|
| 01 Ingestion Telemetry | ✅ Done | 2026-06-29 |
| 02 Agentic Pipeline Stack | ✅ Done | 2026-06-29 |
| 03 Strands Agent Worker | ⬜ Not started | |
| 04 Dynamic Queue Routing | ⬜ Not started | |
| 05 Admin Pipeline Toggle | ⬜ Not started | |
| 06 KPI Pipeline Comparison | ⬜ Not started | |
| 07 Pipeline Evaluation Harness | ⬜ Not started | |

---

## 01 — Ingestion Telemetry ✅ (2026-06-29)

Per-invoice cost & performance telemetry written by the **legacy** worker as
`pipeline_type='LEGACY'`. Foundation for the 06 pipeline comparison; the future Strands worker
(03) reuses the same port/adapter with `'STRANDS'`.

### What shipped

**Migration** — `Source/infra/src/migrations/20260629100000_invoice_telemetry.ts`
- `invoice_telemetry` table per parent §5 (10 cols), 3 indexes, dual `ON DELETE CASCADE`
  (`tenant_id → app_user`, `invoice_id → invoice`).
- RLS `tenant_isolation_policy` on `tenant_id` via `app.current_tenant_id`.
- `admin_pipeline_cost_deficit(DATE, NUMERIC)` SECURITY DEFINER fn + `REVOKE … FROM PUBLIC`
  (mirrors `admin_business_kpis`). **Defined but not yet called** — 06 surfaces it.
- Applied + verified on **local** Postgres (RLS on, 3 indexes, PUBLIC has no EXECUTE).
  **Not yet applied to dev/prod** — runs via the normal deploy `migrate:up`.

**Per-stage metering** (so `cost_usd` is priced per model role, not a blended total)
- `core/domain/tokenMeter.ts`: `record(stage, in, out)`; added `inputTotal`, `outputTotal`,
  `stageBreakdown()`. `total` unchanged → the credit-charge path is untouched.
- `MeteringBedrockConverse` passes `request.stage`; `MeteringBedrockEmbedder` passes `'EMBEDDING'`.
- `core/domain/aiSpend.ts`: extracted `estimateCostUsd(stages)` (exported) + private
  `costForStage`; `toAiSpendRows` reuses it. **One pricing source** (`RATE_PER_1K`), no second table.

**Port + adapter**
- `core/ports/observability/ITelemetryRepository.ts` (`InvoiceTelemetryRecord`).
- `infrastructure/adapters/observability/TelemetryRepositoryAdapter.ts` — single parameterised
  INSERT on a `Pool | PoolClient`.

**Worker** — `handlers/ingestion-worker/index.ts`
- After `chargeIngestion`, before `COMMIT`, on `outcome.handled`: writes one telemetry row
  (in-transaction, RLS-scoped, atomic with the invoice rows). `processing_ms = workerMs`.
- Emits the `invoice_processed` structured log after COMMIT, beside `ingestion timing`.
- Duplicate deliveries (`handled:false`) and rolled-back failed/quarantined runs write no row.

**GDPR** — cascade FK handles the hard purge; `invoice_telemetry` added to the personal-data
list in `specs/mvp/14-gdpr-data-lifecycle.md`.

**Tests** — `tokenMeter.test.ts` (rewritten), `aiSpend.test.ts` (+`estimateCostUsd`),
`TelemetryRepositoryAdapter.test.ts` (new, mocked client).

### Validation (all green, 2026-06-29)
- hexagonal-architecture-validator → exit 0
- `test:unit` → 94 files / 711 tests pass (incl. the 3 new/updated suites)
- `validate:security` → pass
- `tsc --noEmit` (backend + infra) → clean
- local `migrate:up` applied + schema verified

### Decisions baked in
- Migrations live in **`Source/infra/src/migrations/`** (backend `CLAUDE.md` says `src/migrations/`
  but that dir does not exist — infra is canonical).
- `processing_ms` = worker compute time, not end-to-end incl. queue wait.
- Telemetry write is in the unified transaction by spec (atomic with the comparison). It is
  practically unfailable (all NOT-NULL fields supplied, FKs satisfied, CHECK always `'LEGACY'`).

### Known gaps / follow-ups (not blockers for 01)
- **PDF cost under-estimated:** PDF parses run through `VisionParseService` with a hardcoded
  `VISION_PARSE` stage, so they price at the `vision_parser` rate, never `pdf_parser`. `STAGE_ROLE`
  has no entry mapping to `pdf_parser`. **Pre-existing** — `toAiSpendRows`/the daily rollup behave
  identically. Fix once (add a PDF stage + `STAGE_ROLE` entry) to correct both the rollup and this
  telemetry together; out of scope here.
- `admin_pipeline_cost_deficit` has no caller yet — wire it in **06**.
- No integration test exercising the live INSERT under RLS (cross-tenant read denial). The
  mocked-port unit test covers the contract; add an integration test when the agentic stack lands.

---

## 02 — Agentic Pipeline Stack ✅ (2026-06-29)

Standalone `WobblioAgenticPipelineStack` isolating the agentic worker's compute + queue from
`WobblioBackendStack`. Deployable alone; the queue gets no traffic until routing (04) flips the flag.

### What shipped
- **Stack** `Source/infra/src/cdk/stacks/WobblioAgenticPipelineStack.ts`:
  - `WobblioAgenticQueue` (visibility 300s, KMS via `dbStack.kmsKey`, enforceSSL, redrive
    `maxReceiveCount:3`) + `WobblioAgenticDLQ` (14-day, KMS).
  - `WobblioAgenticDLQNotEmptyAlarm` — CloudWatch alarm on `ApproximateNumberOfMessagesVisible > 0`
    (Maximum, 5-min period, 1 eval). No SNS action wired (spec specifies none).
  - `WobblioAgenticWorkerLambda` — Node 24, ARM64, 512MB, 300s, reserved concurrency 5; SQS event
    source `batchSize:1`, `maxConcurrency:5`, `reportBatchItemFailures`.
  - IAM (mirrors ingestion worker, no wildcards beyond suppressed bedrock/SSM/grant patterns):
    queue consume, uploads bucket read, KMS, DB secret read, SSM `/shared/db/*` +
    stage-scoped `models/*`,`tags/*`,`features/*`, bedrock invoke (foundation-model + inference-profile).
  - Cross-stack export: queue URL → SSM `/wobblio/config/<stage>/queues/agentic_url` (routing 04 reads it).
- **Skeleton worker** `Source/backend/src/handlers/agentic-worker/index.ts` — no-op SQS handler
  (empty `batchItemFailures`); agent logic lands in 03. Exists so the stack bundles + deploys now.
- **Wiring** `bin/wobblio.ts` — instantiated after db/storage (deps on db, storage, config); non-local only.
- **Test** `Source/infra/test/WobblioAgenticPipelineStack.test.ts` — queue/DLQ/alarm/worker/event-source
  props, IAM grant assertions, SSM export, **and a cdk-nag `AwsSolutionsChecks` no-error assertion**.

### Validation (2026-06-29)
- infra vitest: 32 pass (incl. 7 new + the cdk-nag no-un-suppressed-error gate).
- `tsc --noEmit` infra + backend → clean.
- Note: a full `cdk synth` of the whole app needs AWS creds/context (backend's `HostedZone.fromLookup`),
  so cdk-nag is gated locally via the per-stack `AwsSolutionsChecks` aspect in the vitest, not `cdk synth`.

### Decisions / notes
- Export param is **stage-scoped** (`configParamName`) rather than the spec's flat
  `/wobblio/config/queues/agentic_url`, to match the rest of the config namespace + backend `stageConfig`.
- SSM grant is exactly `models/tags/features` per spec §3. **If 03's agent charges credits**, it will
  also need the `quotas/*` grant (as the ingestion worker has) — add then, not now (YAGNI).
- `grantBedrockInference` / `configParamArn` / `commonLambdaEnv` are replicated inline (now in 2 stacks;
  extract to a shared helper on the 3rd per Rule-of-Three).

### Next: 03 — Strands Agent Worker
Replace the skeleton handler with the coordinator agent + 5 tools wrapping the domain services
(Zod schemas; reuse idempotency/RLS + the 01 telemetry write path with `pipeline_type='STRANDS'`).
First task per locked decision #3: verify `@strands-agents/sdk` is Node-24/Lambda-ready, else use the
documented in-house tool-loop fallback.
