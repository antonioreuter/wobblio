# Deferred design — Weekly advisor on Bedrock Batch Inference

**Status:** deferred (not implemented)
**Owner trigger:** revisit when the weekly eligible cohort approaches **100 tenants**
**Supersedes:** the current bounded-concurrency on-demand path only when the trigger is met
**Related:** `docs/amendments/2026-06-17-weekly-advisor-tier-and-concurrency.md`

## Why this is deferred

`CreateModelInvocationJob` requires **≥100 records per job** (some models effectively
≥1,000), and jobs below the floor fail hard. The weekly advisor cohort (PREMIUM + ACTIVE +
≥1 parsed invoice this week) stays well under 100 at the enforced capacity envelope, so a
batch job would never be submittable today. The on-demand bounded-concurrency path
(`MAX_CONCURRENCY = 8`, 300s Lambda) is correct and cheap at this scale. Build the batch
path only once weekly runs regularly approach the record floor.

Per `code-quality-guard` (YAGNI / Rule-of-Three), do **not** introduce the
`IAdvisorBatchJobs` port, its adapter, or the batch infrastructure until the trigger is
real — this document is the spec to implement against at that point.

## When to implement (entry criteria)

- A typical weekly `list_advisor_eligible_tenants(week_start)` count is consistently
  **≥ `BATCH_MIN_RECORDS`** (set `BATCH_MIN_RECORDS = 100`, sourced from SSM
  `/wobblio/config/advisor/batch_min_records`).
- Confirm the live `…/models/auxiliary` id supports `CreateModelInvocationJob` in the
  active Region (EU routing via inference profile / cross-Region from `eu-west-1`).

## Target architecture

`WeeklyAdvisorService.run(today)` gathers facts for all eligible tenants (DB only) and
builds one record per tenant (`recordId = tenantId`, `content = buildFactsXml(facts)`).

- **If `records.length >= BATCH_MIN_RECORDS`** → submit a batch job, persist an
  `advisor_batch_job(job_id, week_start)` row, and return. Completion is async (below).
- **Else** → the existing bounded-concurrency on-demand path with direct `save`
  (also the dev / local / STAGE=local Ollama path). This branch stays forever as the
  small-cohort/fallback path.

Crons are prod-only; local/dev always take the on-demand branch.

### Domain / ports (hexagonal — SDK only in adapters)

New port `core/ports/ai/IAdvisorBatchJobs.ts`:

```ts
export interface AdvisorBatchRecord { recordId: string; content: string; }
export interface IAdvisorBatchJobs {
  submit(jobName: string, records: AdvisorBatchRecord[]): Promise<string /* jobId */>;
  readResults(jobId: string): Promise<AdvisorBatchRecord[]>;
}
```

Adapter `infrastructure/adapters/ai/AdvisorBatchJobsAdapter.ts`:
- Writes one-record-per-tenant **JSONL** to the batch S3 input prefix.
- Calls `CreateModelInvocationJob` (input/output S3 URIs + Bedrock batch **service role**).
- `readResults(jobId)` reads the S3 output JSONL on completion.
- The `@aws-sdk/*` imports live **only** here.

### Service

- `recordId = tenantId`, `content = buildFactsXml(facts)` (single-tenant prompt — isolation
  preserved exactly as today).
- Persist `advisor_batch_job(job_id, week_start, submitted_at)` after submit.

### Completion handler

New `handlers/advisor-batch-complete/index.ts`, triggered by an **EventBridge rule** on
*Bedrock Batch Inference Job State Change → Completed*:
1. Look up `week_start` from `advisor_batch_job` by `job_id`.
2. `readResults(jobId)`.
3. `clampWords(content, 120)` and `save_weekly_advisor(tenantId, week_start, body)` per record.

### Migration (edit `20260616103000_weekly_advisor.ts` in place while it is still untracked;
otherwise a new migration)

- Add table `advisor_batch_job (job_id TEXT PRIMARY KEY, week_start DATE NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now())`.
- If completion runs cross-tenant, add a `save`/`get` SECURITY DEFINER pair mirroring the
  existing advisor functions (no RLS tenant context on the cron path).

### CDK (`Source/infra/src/cdk/stacks/WobblioBackendStack.ts`)

- New `advisor-batch-complete` Lambda (300s via the existing `timeoutSeconds` arg on
  `makeLambda`) + EventBridge rule for the Bedrock batch-completed event.
- New S3 bucket (or dedicated prefix) for batch I/O: block public access, KMS, enforce SSL.
- IAM (least privilege):
  - **Bedrock batch service role** (Bedrock-assumed): scoped S3 read/write on the batch
    bucket only.
  - **Orchestrator** (`cron-weekly-advisor`): `bedrock:CreateModelInvocationJob` +
    `iam:PassRole` (the service role) + S3 put on the batch input prefix +
    `…/models/auxiliary` + `…/advisor/batch_min_records` SSM read.
  - **Completion Lambda**: `bedrock:GetModelInvocationJob` + S3 get on the output prefix +
    DB secret / SSM read.
- Mirror the existing advisor block's cdk-nag suppressions.
- Keep the weekly `WeeklyAdvisorCron` schedule on the orchestrator.

## Tests to add

- `WeeklyAdvisorService.test.ts`: batch path (mocked `IAdvisorBatchJobs`) when cohort ≥
  `BATCH_MIN_RECORDS`; on-demand concurrency path when below.
- CDK assertion for the new Lambda + EventBridge rule + batch bucket.

## Guardrails preserved

One single-tenant record per tenant (no cross-tenant prompt leakage); `<facts>` XML
separators with escaped values; `prompt_version` recorded; model ids stay opaque SSM
values; tags never enter the Price Observation Store (advisor never touches it).
