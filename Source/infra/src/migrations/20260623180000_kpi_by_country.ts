import type { MigrationBuilder } from 'node-pg-migrate';

// Per-country breakdowns for the KPI dashboard's country filter (dimensioned rollup).
// User metrics group by the user's country (app_user.country_code); invoice metrics
// group by the invoice's confirmed location (location_country_code). The rollup writes
// these as {country}-dimensioned kpi_daily rows alongside the national totals.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION admin_user_kpis_by_country(p_date DATE)
    RETURNS TABLE (
      country CHAR(2), registrations BIGINT, total_users BIGINT, premium_count BIGINT,
      standard_users BIGINT, waitlist_users BIGINT, deleted_users BIGINT,
      active_users BIGINT, users_low_score BIGINT
    )
    SECURITY DEFINER SET search_path = public LANGUAGE sql STABLE
    AS $$
      SELECT
        u.country_code,
        COUNT(*) FILTER (WHERE u.created_at::date = p_date),
        COUNT(*),
        COUNT(*) FILTER (WHERE u.role = 'PREMIUM'),
        COUNT(*) FILTER (WHERE u.role = 'STANDARD'),
        COUNT(*) FILTER (WHERE u.status = 'WAITLIST'),
        COUNT(*) FILTER (WHERE u.status = 'DELETED'),
        COUNT(*) FILTER (WHERE u.status = 'ACTIVE'),
        COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM tenant_trust t WHERE t.tenant_id = u.id AND t.trust_score < 30))
      FROM app_user u
      GROUP BY u.country_code;
    $$;
    REVOKE ALL ON FUNCTION admin_user_kpis_by_country(DATE) FROM PUBLIC;

    CREATE OR REPLACE FUNCTION admin_invoice_kpis_by_country(p_date DATE)
    RETURNS TABLE (
      country CHAR(2), invoices_processed BIGINT, invoices_failed BIGINT, invoices_pending BIGINT,
      feedback_positive BIGINT, feedback_negative BIGINT, feedback_none BIGINT
    )
    SECURITY DEFINER SET search_path = public LANGUAGE sql STABLE
    AS $$
      SELECT
        i.location_country_code,
        COUNT(*) FILTER (WHERE i.created_at::date = p_date AND i.status IN ('PARSED', 'NEEDS_REVIEW')),
        COUNT(*) FILTER (WHERE i.created_at::date = p_date AND i.status = 'FAILED_PROCESSING'),
        COUNT(*) FILTER (WHERE i.status = 'PROCESSING'),
        COUNT(*) FILTER (WHERE i.created_at::date = p_date AND i.status IN ('PARSED', 'NEEDS_REVIEW')
          AND EXISTS (SELECT 1 FROM invoice_feedback f WHERE f.invoice_id = i.id AND f.verdict = 'UP')),
        COUNT(*) FILTER (WHERE i.created_at::date = p_date AND i.status IN ('PARSED', 'NEEDS_REVIEW')
          AND EXISTS (SELECT 1 FROM invoice_feedback f WHERE f.invoice_id = i.id AND f.verdict = 'DOWN')),
        COUNT(*) FILTER (WHERE i.created_at::date = p_date AND i.status IN ('PARSED', 'NEEDS_REVIEW')
          AND NOT EXISTS (SELECT 1 FROM invoice_feedback f WHERE f.invoice_id = i.id))
      FROM invoice i
      WHERE i.location_country_code IS NOT NULL
      GROUP BY i.location_country_code;
    $$;
    REVOKE ALL ON FUNCTION admin_invoice_kpis_by_country(DATE) FROM PUBLIC;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP FUNCTION IF EXISTS admin_user_kpis_by_country(DATE);
    DROP FUNCTION IF EXISTS admin_invoice_kpis_by_country(DATE);
  `);
}
