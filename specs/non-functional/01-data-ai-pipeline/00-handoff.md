# 00 — Living Handoff · Non-Functional 01 (Agentic Ingestion Pipeline)

Running status of the epic so work resumes cleanly across context resets. Update this file as
each sub-spec lands. The [README](./README.md) Build Status table is the one-line index; this is
the detail.

| Sub-spec | Status | Landed |
|---|---|---|
| 01 Ingestion Telemetry | ✅ Done | 2026-06-29 |
| 02 Agentic Pipeline Stack | ✅ Done | 2026-06-29 |
| 03 Strands Agent Worker | ✅ Done | 2026-06-29 |
| 04 Dynamic Queue Routing | ✅ Done | 2026-06-29 |
| 05 Admin Pipeline Toggle | ✅ Done | 2026-06-29 |
| 06 KPI Pipeline Comparison | ✅ Done | 2026-06-30 |
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

---

## 03 — Strands Agent Worker ✅ (2026-06-29)

The agentic worker now runs a real pipeline (`pipeline_type='STRANDS'`), reusing every domain
service + cross-cutting guarantee of the legacy worker.

### Key decision: deterministic workflow + tool seam, NO `@strands-agents/sdk`
The spec mandates a **forced** tool order, which removes all model-driven control flow — so an LLM
agent would add a heavy, unverified dep (ARM64/Lambda/esbuild) on the critical path for an order we
must fix anyway. `@strands-agents/sdk@1.7.0` exists (`engines.node >=20`) and can later implement the
same `InvoiceCoordinator.extract` contract unchanged, but is **deferred**. Also: the codebase has no
Zod — schema validation uses the hand-rolled `receiptSchema.ts` `{ok,issues}` idiom, which already
runs (with 1 retry → DLQ) inside `VisionParseService` (the only untrusted-JSON boundary). The
arithmetic-balance + integrity gate runs once, downstream, in the shared `InvoiceFinalizer`. So the
coordinator carries **no** redundant schema/retry/arithmetic — it is pure forced-order dispatch.

### Structure (parallel service + shared front/tail)
- **Shared front** `core/services/ingestion/ExtractionPreparer.ts` — idempotency claim, pre-AI
  validation, OCR (via `OcrParserTool`), unreadable early-exit, location resolution. Both pipelines.
- **Shared tail** `core/services/ingestion/InvoiceFinalizer.ts` — fuzzy-dup, integrity, status,
  persist, price emission, ledger DONE. Both pipelines → guarantees A/B parity.
- **Legacy `IngestionService`** refactored to `preparer → direct 5-stage calls → finalizer`
  (ctor unchanged; its 26 unit tests pass unmodified = the refactor's safety net).
- **Tools** `core/services/ingestion/agentic/tools/` — 5 thin wrappers (Ocr/Merchant/Product/
  Classifier/SearchTag). `OcrParserTool` owns file-type→model routing and is used by the preparer
  (so all 5 tools are real + wired, no double-parse).
- **`InvoiceCoordinator`** — forced-order dispatch of the 4 canonicalization tools → `ExtractionResult`.
- **`AgenticIngestionService`** — `preparer → coordinator → finalizer`.
- **Shared worker shell** `handlers/shared/ingestionWorkerShell.ts` — `runIngestionRecord(ctx,
  buildService, pipelineType)` owns the unified tx (process → charge → telemetry → COMMIT),
  post-COMMIT side effects, and the rollback/DLQ/quarantine path. Both `ingestion-worker` (LEGACY)
  and `agentic-worker` (STRANDS) handlers are now thin: cold-start setup + `buildService` + loop.

### Validation (2026-06-29)
- hexagonal-architecture-validator → exit 0 (all core, no SDK imports).
- `test:unit` → 97 files / 724 pass (legacy 26 unchanged + 13 new: coordinator, agentic service, tools).
- `tsc --noEmit` → clean.
- Caught in self-review: the shared error path must **await** quarantine/failUserFault (they run
  BEGIN/COMMIT on the client the loop releases) — fixed before tests.

### Functional note (honest)
STRANDS is functionally **equivalent** to LEGACY (same services, same order) — by design, since the
order is forced. Its value is structural: the tool seam (07 eval harness), the separate worker/queue
(02, for 04/05 routing+toggle), and `pipeline_type='STRANDS'` telemetry (06 comparison). A real
model-driven coordinator can later slot into `InvoiceCoordinator` without touching tools/finalizer/shell.

### Not done / deferred
Real `@strands-agents/sdk` agent (documented future swap). No new migration/infra (telemetry table +
adapter shipped in 01). Local end-to-end A/B smoke against the agentic queue not yet run (needs a
LocalStack message on the agentic queue) — recommended before 04 routing flips real traffic.

---

## 04 — Dynamic Queue Routing ✅ (2026-06-29)

Confirm-time pipeline selection: a confirmed invoice routes to the legacy **or** agentic queue
behind a new domain port. Ships dark — the flag defaults `false` → legacy, so no traffic reaches
the agentic queue until 05's admin toggle flips it.

### What shipped
- **Port** `core/ports/ingestion/IInvoiceIngestionQueuePort.ts` — `enqueue(invoiceId, tenantId,
  s3Key)`, verbatim from spec. Created **alongside** `IIngestionQueue` (locked decision #1, not
  merged) — the latter still carries the operator `reprocess` flag.
- **Adapter** `infrastructure/adapters/ingestion/SqsInvoiceIngestionQueueAdapter.ts` — holds an
  `SSMClient` + `SQSClient`. One TTL-cached (`5 min`, `SsmUploadQuotaAdapter` pattern)
  `GetParameters` batch over `features/agentic_pipeline_enabled` + `queues/agentic_url`
  (stage-scoped). Flag `'true'`/`'1'` AND URL present → agentic; else legacy. Same
  `{invoiceId,tenantId,s3Key}` body + `SendMessage` as the legacy adapter.
- **Fail-safe (inverse of the quota adapter's fail-closed):** any SSM error / missing flag /
  missing URL → legacy. `fetchRouting` try/catch returns legacy routing; a confirm never throws
  on SSM and never drops the message.
- **Rewire** `ConfirmService` ctor dep `IIngestionQueue → IInvoiceIngestionQueuePort` + positional
  enqueue; `handleConfirm` (api-handler) instantiates the new adapter. `INGEST_QUEUE_URL` env
  unchanged (legacy URL); agentic URL resolved in-adapter from SSM.
- **IAM** `WobblioBackendStack` — one enumerated (no-wildcard) `ssm:GetParameter(s)` grant on
  `apiHandlerFn` for `features/agentic_pipeline_enabled` + `queues/agentic_url`. No new env, **no
  cross-stack CDK dependency** on the agentic stack.
- **Config** seeded `features/agentic_pipeline_enabled: "false"` in `config/config.{local,dev,prod}.json`.
  `queues/agentic_url` is written by the agentic stack at deploy (not seeded here).

### Decisions / notes
- **Agentic URL via SSM, not env** (spec §3 said env): stack 02 deliberately exported it to SSM to
  avoid coupling `WobblioBackendStack` to the agentic stack. Reading both params in-adapter honours
  that and keeps the stacks independently deployable. User-confirmed.
- **Confirm path only.** The admin reprocess-on-behalf path (`adminFaultRoutes.ts`) still uses the
  legacy queue + `IIngestionQueue` (it needs `reprocess:true`, which the 3-arg port can't carry).
  Follow-up if reprocess should ever honour the flag.
- Local has no agentic stack → `queues/agentic_url` absent locally → adapter routes to legacy (the
  intended dark default).

### Validation (2026-06-29)
- hexagonal-architecture-validator → exit 0.
- `test:unit` → 98 files / 730 pass (6-case new adapter suite + updated ConfirmService positional asserts).
- infra vitest → 32 pass (IAM grant enumerated → cdk-nag aspect still no-error).
- `tsc --noEmit` backend + infra → clean. `validate:security` → pass.

---

## 05 — Admin Pipeline Toggle ✅ (2026-06-29)

Operator runtime control of the `agentic_pipeline_enabled` flag (the one 04 routes on), with an
audit trail and canary guidance — switch pipelines and roll back without a deploy.

### What shipped (backend)
- **Domain allowlist** `core/domain/featureFlags.ts` — `FEATURE_FLAGS` (single entry:
  `agentic_pipeline_enabled` → `/wobblio/config/features/agentic_pipeline_enabled`), `findFeatureFlag`
  (throws `UnknownAdminTargetError`), `isFlagEnabled` (`'true'`/`'1'` → on, matches the 04 routing read).
- **Service** `core/services/admin/AdminFeatureToggleService.ts` — `list()` (current enabled state),
  `toggle(actor, feature, value)` (validate allowlist + boolean → write `'true'`/`'false'` via the
  existing `ITunableParameterStore` → audit `feature.toggle` with before/after enabled), `history(limit)`
  (delegates to `IAdminAuditLog.list('feature.toggle', …)`). **Reuses** the SSM tunable store +
  audit log adapters unchanged (parallel to `AdminConfigService`, not merged — distinct contract).
- **Audit action** `'feature.toggle'` added to the `AdminAuditAction` union.
- **Route** `handlers/api-handler/adminFeatureRoutes.ts` — `GET /admin/features`,
  `GET /admin/features/audit`, `POST /admin/features/toggle` (`{feature, value}`); wired into
  `adminRoutes.ts` (`/admin/features` prefix). ADMIN-gated by the existing `handleAdminRoute` guard.
- **IAM** `WobblioBackendStack` — enumerated `ssm:PutParameter` on `features/agentic_pipeline_enabled`
  (read was already granted in 04). No wildcard → cdk-nag IAM5 clean.

### What shipped (admin app)
- `Source/admin/src/app/(console)/pipeline-toggles/` — `page.tsx` + `pipeline-toggles-section.tsx`:
  per-flag switch (Legacy/Agentic), `ConfirmDialog` before flipping live traffic, **canary alert**
  (watch DOWN-ratio + latency ~30 min; flip takes effect within the ~5-min routing cache TTL), and
  a toggle-history list. `data-testid`: `canary-alert`, `feature-toggle-<feature>`, `feature-row`,
  `feature-audit-log`, `feature-audit-row`, `toggle-notice`. Nav link registered in `(console)/layout.tsx`
  (`Workflow` icon → `nav-pipeline-toggles`). BFF proxy `/api/admin/features* → /admin/features*`.

### Decisions / notes
- **ADMIN only, no OPERATOR.** Spec §1 says "ADMIN or OPERATOR", but this system has no OPERATOR role
  (roles = STANDARD/PREMIUM/TESTER/ADMIN). The whole admin surface is ADMIN-gated; kept that.
- **Separate service**, not folded into `AdminConfigService` — boolean-only, feature allowlist,
  distinct `feature.toggle` action + endpoint contract per spec (2nd occurrence → no shared abstraction).
- SSM writes `'true'`/`'false'`; the 04 adapter already treats `'true'`/`'1'` as on, so they interoperate.

### Validation (2026-06-29)
- hex validator → exit 0. `test:unit` → 100 files / 738 pass (7-case service suite + 1 admin-gate
  guard test — the gate had no prior coverage). `validate:security` → pass.
- `tsc --noEmit` backend + infra → clean. infra vitest → 32 pass (IAM addition enumerated, nag clean).
- admin app `npm run lint` (next lint + tsc) → clean.

---

## 06 — KPI Pipeline Comparison ✅ (2026-06-30)

Daily per-pipeline rollup of `invoice_telemetry` into `kpi_daily` (dimension `{pipeline_type}`)
+ a legacy-vs-Strands comparison section on the admin dashboard.

### What shipped (backend)
- **Migration** `Source/infra/src/migrations/20260630120000_pipeline_kpis_fn.ts` —
  `admin_pipeline_kpis(DATE)` SECURITY DEFINER fn (`admin_business_kpis` pattern; the cron has no
  tenant context so it can't read RLS-scoped `invoice_telemetry` directly). Returns per
  `pipeline_type`: count, avg processing_ms, avg cost_usd, needs-review count, feedback DOWN +
  rated counts. Feedback joined via **LATERAL latest-verdict** (no fan-out → telemetry
  counts/averages stay one-row-per-invoice). `REVOKE … FROM PUBLIC`. **Not yet applied to
  dev/prod/local** — runs via deploy `migrate:up` (fn grant reconciled by the deploy GRANT-ON-ALL).
- **Domain** `core/domain/pipelineKpis.ts` — `PIPELINE_METRICS` (4 names) + `toPipelineKpiRows`
  (derives needs-review-rate + feedback-down-ratio with zero-denominator guards → 0, not NaN).
- **Port/adapter** `IPipelineKpiSource` + `PipelineKpiDbAdapter` (`SELECT * FROM admin_pipeline_kpis($1)`).
- **Service** `PipelineKpiRollupService` (empty day → 0 rows). Wired into
  `cron-ingestion-metrics-rollup` as a 5th independent rollup (`pipeline_comparison`).
- **Read** `AdminKpiService` DEFAULT_METRICS now includes the 4 pipeline metrics, so the existing
  `GET /admin/kpis` returns them with no endpoint-shape change (filter by `dimensions.pipeline_type`).

### What shipped (admin app)
- `Source/admin/src/app/(console)/pipeline-comparison.tsx` — self-contained `<PipelineComparison>`
  with its **own fixed 90-day** kpi fetch (independent of the dashboard's week selector, per the
  spec's "90-day" requirement). 4 comparison cards (latency, cost/invoice, needs-review rate,
  feedback DOWN ratio — Legacy vs Strands, winner highlighted, lower-is-better) + 2 multi-line
  90-day charts (latency, cost). Rendered on `(console)/page.tsx` above Growth. `data-testid`:
  `pipeline-performance-cards`, `pipeline-performance-latency`, `pipeline-performance-cost`.

### Decisions / notes
- **SQL rollup over `invoice_telemetry`** (not the CloudWatch-Logs timing source) — feedback +
  cost + status all live in the table/feedback join, and the table is the spec's "ingestion telemetry".
- The spec mentioned wiring `admin_pipeline_cost_deficit` (shipped in 01); that fn is per-tenant
  cost-deficit (different shape). 06 needs day×pipeline aggregates, so it gets its **own** thin
  aggregate-only fn `admin_pipeline_kpis` — kept the per-tenant one untouched.
- Both pipelines populate only once 04's flag routes real traffic to STRANDS; until then only
  LEGACY rows exist and the Strands column reads `—`.

### Validation (2026-06-30)
- hex validator → exit 0. `test:unit` → 102 files / 743 pass (+5: domain math + rollup service).
- `validate:security` → pass (new SECURITY DEFINER fn + REVOKE scanned). infra + backend `tsc` → clean.
- admin `npm run lint` (next lint + tsc) → clean.
- **Not run:** live `migrate:up` (applies on deploy) and a real end-to-end with STRANDS traffic.

### Next: 07 — Pipeline Evaluation Harness
`scripts/evaluate-pipelines.ts` + LLM-as-a-judge offline comparison. Reuses the dry-run processor
seam from 03 (`InvoiceCoordinator`/tools). Last sub-spec of the epic.
