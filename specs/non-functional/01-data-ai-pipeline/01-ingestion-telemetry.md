# 01 — Ingestion Telemetry (`invoice_telemetry`)

**Non-Functional 01 · Phase 3/5 · Per-invoice cost & performance telemetry**

Parent: [../01-data-ai-pipeline.md](../01-data-ai-pipeline.md) §5 · Index: [README](./README.md)

## Overview

A per-invoice telemetry record (processing time, token consumption, cost) written by **both**
pipelines, enabling cohort-level cost analysis (are users consuming more in LLM fees than their
subscription covers?) and the side-by-side pipeline comparison in [06](./06-kpi-pipeline-comparison.md).

Ships first against the **legacy** worker (`pipeline_type='LEGACY'`); the Strands worker
([03](./03-strands-agent-worker.md)) reuses the same write path with `'STRANDS'`. No agentic
dependency — this is the foundation.

## Dependencies

- None. Independent of the agentic stack.
- Reuses: `ingestion-worker/index.ts` transaction, `TenantContextAdapter`, existing
  `AiSpendRollupService` token→cost pricing source.

## Design

### 1. Table & migration (node-pg-migrate)

Per parent §5 — `invoice_telemetry(id, tenant_id, invoice_id, processed_on, pipeline_type,
processing_ms, input_tokens, output_tokens, cost_usd, status)` with the three indexes
(`tenant`, `invoice`, `date`). `pipeline_type` CHECK in (`'LEGACY'`,`'STRANDS'`).

`ON DELETE CASCADE` on both `tenant_id REFERENCES app_user(id)` and
`invoice_id REFERENCES invoice(id)`.

### 2. Visibility — RLS + SECURITY DEFINER (locked decision #2)

RLS for tenant self-reads:

```sql
ALTER TABLE invoice_telemetry ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON invoice_telemetry
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
```

The cross-tenant cost-deficit query (parent §5) cannot run under RLS, so it becomes a
`SECURITY DEFINER` function (the `admin_business_kpis` pattern; never `FORCE RLS`):

```sql
CREATE FUNCTION admin_pipeline_cost_deficit(p_month_start DATE, p_threshold NUMERIC)
RETURNS TABLE (tenant_id UUID, current_subscription_tier TEXT, total_invoices_processed BIGINT,
               total_monthly_api_cost NUMERIC, total_input_tokens BIGINT, total_output_tokens BIGINT)
SECURITY DEFINER SET search_path = public
LANGUAGE sql STABLE AS $$
  SELECT t.tenant_id, u.role, COUNT(t.invoice_id), SUM(t.cost_usd),
         SUM(t.input_tokens), SUM(t.output_tokens)
  FROM invoice_telemetry t JOIN app_user u ON t.tenant_id = u.id
  WHERE t.processed_on >= p_month_start
  GROUP BY t.tenant_id, u.role
  HAVING SUM(t.cost_usd) > p_threshold
  ORDER BY 4 DESC
$$;
REVOKE ALL ON FUNCTION admin_pipeline_cost_deficit(DATE, NUMERIC) FROM PUBLIC;
```

`invoice_telemetry` is **not** added to the globally-readable table list in `Source/backend/CLAUDE.md`.

### 3. Write path

Inside the worker's existing unified transaction (after tenant writes, before COMMIT), insert
one row. `pipeline_type` is a parameter (`'LEGACY'` here). `cost_usd` is derived from the
**existing** `AiSpendRollupService` per-model token pricing — do not introduce a second pricing
table. Emit the `invoice_processed` structured log (parent §5) alongside the DB write.

### 4. GDPR

Cascade-delete is enforced by the FK `ON DELETE CASCADE`. Add `invoice_telemetry` to the
GDPR hard-purge validation set in [../../mvp/14-gdpr-data-lifecycle.md](../../mvp/14-gdpr-data-lifecycle.md).

## Checklist

- [ ] Migration: `invoice_telemetry` + indexes + dual `ON DELETE CASCADE`
- [ ] RLS policy on `tenant_id` (`app.current_tenant_id`)
- [ ] `admin_pipeline_cost_deficit(...)` SECURITY DEFINER fn + `REVOKE ... FROM PUBLIC`
- [ ] Legacy worker writes telemetry inside the unified transaction; `cost_usd` via `AiSpendRollupService` pricing
- [ ] `invoice_processed` structured log emitted
- [ ] GDPR purge validation includes `invoice_telemetry`
- [ ] `npm run validate:security` green; mocked-port unit test for the write path
