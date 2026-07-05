import type { MigrationBuilder } from 'node-pg-migrate';

// Legacy ingestion pipeline decommissioned — only the agentic (STRANDS) pipeline remains, so the
// LEGACY-vs-STRANDS comparison is retired: drop the per-pipeline KPI function and the
// invoice_telemetry.pipeline_type dimension it grouped on. invoice_telemetry itself stays as the
// single-pipeline per-invoice telemetry store.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DROP FUNCTION IF EXISTS admin_pipeline_kpis(DATE);`);
  pgm.sql(`ALTER TABLE invoice_telemetry DROP COLUMN IF EXISTS pipeline_type;`);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Re-add the column (defaulting existing rows to STRANDS — legacy no longer exists) and recreate
  // the per-pipeline aggregation function.
  pgm.sql(`
    ALTER TABLE invoice_telemetry
      ADD COLUMN pipeline_type VARCHAR(20) NOT NULL DEFAULT 'STRANDS'
      CHECK (pipeline_type IN ('LEGACY', 'STRANDS'));
  `);
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
