import type { MigrationBuilder } from 'node-pg-migrate';

// Non-Functional 01 · 06 — per-pipeline daily KPI aggregation for the legacy-vs-Strands
// comparison dashboard. invoice_telemetry is tenant-scoped (RLS), and the rollup cron runs
// with no tenant context, so the aggregation runs through a SECURITY DEFINER helper — the
// admin_business_kpis pattern (never FORCE RLS). Aggregate-only output (per pipeline_type,
// no tenant/invoice ref) so the rollup can land it in the globally-readable kpi_daily.
//
// Feedback is attributed via the latest verdict per invoice (LATERAL, no fan-out) so the
// telemetry averages/counts stay one-row-per-invoice. Function grant to the runtime role is
// reconciled by deploy (GRANT ON ALL FUNCTIONS), mirroring the other migrations.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE FUNCTION admin_pipeline_kpis(p_date DATE)
    RETURNS TABLE (
      pipeline_type      TEXT,
      invoice_count      BIGINT,
      avg_processing_ms  NUMERIC,
      avg_cost_usd       NUMERIC,
      needs_review_count BIGINT,
      feedback_down      BIGINT,
      feedback_rated     BIGINT
    )
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE sql
    STABLE
    AS $$
      SELECT t.pipeline_type,
             COUNT(*),
             AVG(t.processing_ms),
             AVG(t.cost_usd),
             COUNT(*) FILTER (WHERE t.status = 'NEEDS_REVIEW'),
             COUNT(*) FILTER (WHERE fb.verdict = 'DOWN'),
             COUNT(*) FILTER (WHERE fb.verdict IN ('UP', 'DOWN'))
      FROM invoice_telemetry t
      LEFT JOIN LATERAL (
        SELECT f.verdict
        FROM invoice_feedback f
        WHERE f.invoice_id = t.invoice_id
        ORDER BY f.created_at DESC
        LIMIT 1
      ) fb ON true
      WHERE t.processed_on::date = p_date
      GROUP BY t.pipeline_type;
    $$;
    REVOKE ALL ON FUNCTION admin_pipeline_kpis(DATE) FROM PUBLIC;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DROP FUNCTION IF EXISTS admin_pipeline_kpis(DATE);`);
}
