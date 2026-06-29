import type { MigrationBuilder } from 'node-pg-migrate';

// Non-Functional 01 · 01 — per-invoice ingestion telemetry (processing time, token
// consumption, estimated USD cost, terminal status). Written by BOTH pipelines: ships
// against the legacy worker (pipeline_type='LEGACY'); the Strands worker (03) reuses the
// same write path with 'STRANDS'. Foundation for the pipeline A/B comparison (06).
//
// Tenant-scoped (holds tenant_id) → RLS, same as every other personal-data table. The
// cross-tenant cost-deficit query cannot run under RLS, so it is a SECURITY DEFINER
// helper (the admin_business_kpis pattern; never FORCE RLS). Dual ON DELETE CASCADE
// satisfies the GDPR hard-purge — account deletion cascades these rows automatically.
//
// Table/function grants to the runtime role are reconciled by deploy (GRANT ON ALL
// TABLES / ALL FUNCTIONS), mirroring the other migrations — no explicit GRANT here.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TABLE invoice_telemetry (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id     UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
      invoice_id    UUID NOT NULL REFERENCES invoice(id) ON DELETE CASCADE,
      processed_on  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      pipeline_type VARCHAR(20) NOT NULL CHECK (pipeline_type IN ('LEGACY', 'STRANDS')),
      processing_ms INTEGER NOT NULL,
      input_tokens  INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      cost_usd      NUMERIC(10, 4) NOT NULL,
      status        VARCHAR(30) NOT NULL
    );

    CREATE INDEX idx_invoice_telemetry_tenant ON invoice_telemetry(tenant_id);
    CREATE INDEX idx_invoice_telemetry_invoice ON invoice_telemetry(invoice_id);
    CREATE INDEX idx_invoice_telemetry_date ON invoice_telemetry(processed_on);

    ALTER TABLE invoice_telemetry ENABLE ROW LEVEL SECURITY;
    CREATE POLICY tenant_isolation_policy ON invoice_telemetry
      USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

    CREATE FUNCTION admin_pipeline_cost_deficit(p_month_start DATE, p_threshold NUMERIC)
    RETURNS TABLE (
      tenant_id                 UUID,
      current_subscription_tier TEXT,
      total_invoices_processed  BIGINT,
      total_monthly_api_cost    NUMERIC,
      total_input_tokens        BIGINT,
      total_output_tokens       BIGINT
    )
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE sql
    STABLE
    AS $$
      SELECT t.tenant_id, u.role, COUNT(t.invoice_id), SUM(t.cost_usd),
             SUM(t.input_tokens), SUM(t.output_tokens)
      FROM invoice_telemetry t JOIN app_user u ON t.tenant_id = u.id
      WHERE t.processed_on >= p_month_start
      GROUP BY t.tenant_id, u.role
      HAVING SUM(t.cost_usd) > p_threshold
      ORDER BY 4 DESC;
    $$;
    REVOKE ALL ON FUNCTION admin_pipeline_cost_deficit(DATE, NUMERIC) FROM PUBLIC;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP FUNCTION IF EXISTS admin_pipeline_cost_deficit(DATE, NUMERIC);
    DROP TABLE IF EXISTS invoice_telemetry CASCADE;
  `);
}
