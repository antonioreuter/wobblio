import type { MigrationBuilder } from 'node-pg-migrate';

// Epic 15 business-KPI nightly rollup (prerequisite for admin-console 07/08). The
// headline numbers are cross-tenant aggregates over RLS-protected tables
// (app_user, invoice, invoice_feedback), so they are read via a SECURITY DEFINER
// helper that bypasses RLS — same mechanism as the waitlist/curation helpers. The
// cron normalizes the raw counts into kpi_daily rows (registrations, DAU/MAU,
// premium, conversion, MRR proxy, feedback score). Churn is intentionally absent —
// there is no subscription-cancellation signal in the schema (flagged as a gap for
// the KPI dashboard rather than fabricated here).
//
// DAU/MAU use invoice activity as the engagement proxy (no per-request activity
// table exists). MAU is the trailing 30 days ending on p_date.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION admin_business_kpis(p_date DATE)
    RETURNS TABLE (
      registrations  BIGINT,
      dau            BIGINT,
      mau            BIGINT,
      premium_count  BIGINT,
      active_users   BIGINT,
      feedback_up    BIGINT,
      feedback_total BIGINT
    )
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE sql
    STABLE
    AS $$
      SELECT
        (SELECT COUNT(*) FROM app_user WHERE created_at::date = p_date),
        (SELECT COUNT(DISTINCT tenant_id) FROM invoice WHERE created_at::date = p_date),
        (SELECT COUNT(DISTINCT tenant_id) FROM invoice
         WHERE created_at::date > p_date - 30 AND created_at::date <= p_date),
        (SELECT COUNT(*) FROM app_user WHERE role = 'PREMIUM'),
        (SELECT COUNT(*) FROM app_user WHERE status = 'ACTIVE'),
        (SELECT COUNT(*) FROM invoice_feedback WHERE created_at::date = p_date AND verdict = 'UP'),
        (SELECT COUNT(*) FROM invoice_feedback WHERE created_at::date = p_date);
    $$;
    REVOKE ALL ON FUNCTION admin_business_kpis(DATE) FROM PUBLIC;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DROP FUNCTION IF EXISTS admin_business_kpis(DATE);`);
}
