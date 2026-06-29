# 00 — Living Handoff · Non-Functional 01 (Agentic Ingestion Pipeline)

Running status of the epic so work resumes cleanly across context resets. Update this file as
each sub-spec lands. The [README](./README.md) Build Status table is the one-line index; this is
the detail.

| Sub-spec | Status | Landed |
|---|---|---|
| 01 Ingestion Telemetry | ✅ Done | 2026-06-29 |
| 02 Agentic Pipeline Stack | ⬜ Not started | |
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

### Next: 02 — Agentic Pipeline Stack
New `WobblioAgenticPipelineStack` (SQS+DLQ, worker Lambda, IAM, cross-stack wiring). Independent of
01. Then 03 reuses this telemetry write path with `pipeline_type='STRANDS'`.
