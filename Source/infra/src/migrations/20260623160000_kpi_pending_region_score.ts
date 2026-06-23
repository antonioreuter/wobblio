import type { MigrationBuilder } from 'node-pg-migrate';

// Adds invoices_pending (status PROCESSING, point-in-time) and users_low_score
// (tenant_trust.trust_score < 30) to admin_business_kpis, plus a per-country/region
// invoice breakdown helper. trust default is 50; < 30 flags genuinely low trust.
const LOW_TRUST = 30;

const BODY = `
        (SELECT COUNT(*) FROM app_user WHERE created_at::date = p_date),
        (SELECT COUNT(DISTINCT tenant_id) FROM invoice WHERE created_at::date = p_date),
        (SELECT COUNT(DISTINCT tenant_id) FROM invoice
         WHERE created_at::date > p_date - 30 AND created_at::date <= p_date),
        (SELECT COUNT(*) FROM app_user WHERE role = 'PREMIUM'),
        (SELECT COUNT(*) FROM app_user WHERE status = 'ACTIVE'),
        (SELECT COUNT(*) FROM invoice_feedback WHERE created_at::date = p_date AND verdict = 'UP'),
        (SELECT COUNT(*) FROM invoice_feedback WHERE created_at::date = p_date),
        (SELECT COUNT(*) FROM invoice_feedback WHERE created_at::date = p_date AND verdict = 'DOWN'),
        (SELECT COUNT(*) FROM invoice
         WHERE created_at::date = p_date AND status IN ('PARSED', 'NEEDS_REVIEW')),
        (SELECT COUNT(*) FROM invoice
         WHERE created_at::date = p_date AND status = 'FAILED_PROCESSING'),
        (SELECT COUNT(*) FROM product WHERE created_at::date = p_date),
        (SELECT COUNT(*) FROM app_user WHERE status = 'WAITLIST'),
        (SELECT COUNT(*) FROM app_user WHERE status = 'DELETED'),
        (SELECT COUNT(*) FROM app_user),
        (SELECT COUNT(*) FROM app_user WHERE role = 'STANDARD'),
        (SELECT COUNT(*) FROM invoice WHERE status = 'PROCESSING'),
        (SELECT COUNT(*) FROM tenant_trust WHERE trust_score < ${LOW_TRUST})
`;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP FUNCTION IF EXISTS admin_business_kpis(DATE);
    CREATE FUNCTION admin_business_kpis(p_date DATE)
    RETURNS TABLE (
      registrations BIGINT, dau BIGINT, mau BIGINT, premium_count BIGINT, active_users BIGINT,
      feedback_up BIGINT, feedback_total BIGINT, feedback_down BIGINT,
      invoices_processed BIGINT, invoices_failed BIGINT, new_products BIGINT,
      waitlist_users BIGINT, deleted_users BIGINT, total_users BIGINT, standard_users BIGINT,
      invoices_pending BIGINT, users_low_score BIGINT
    )
    SECURITY DEFINER SET search_path = public LANGUAGE sql STABLE
    AS $$ SELECT ${BODY}; $$;
    REVOKE ALL ON FUNCTION admin_business_kpis(DATE) FROM PUBLIC;

    -- Invoices uploaded that day, by confirmed location (country + region).
    CREATE OR REPLACE FUNCTION admin_invoices_by_region(p_date DATE)
    RETURNS TABLE (country_code CHAR(2), region_code TEXT, cnt BIGINT)
    SECURITY DEFINER SET search_path = public LANGUAGE sql STABLE
    AS $$
      SELECT location_country_code, location_region_code, COUNT(*)
      FROM invoice
      WHERE created_at::date = p_date AND location_country_code IS NOT NULL
      GROUP BY location_country_code, location_region_code;
    $$;
    REVOKE ALL ON FUNCTION admin_invoices_by_region(DATE) FROM PUBLIC;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP FUNCTION IF EXISTS admin_invoices_by_region(DATE);
    DROP FUNCTION IF EXISTS admin_business_kpis(DATE);
    CREATE FUNCTION admin_business_kpis(p_date DATE)
    RETURNS TABLE (
      registrations BIGINT, dau BIGINT, mau BIGINT, premium_count BIGINT, active_users BIGINT,
      feedback_up BIGINT, feedback_total BIGINT, feedback_down BIGINT,
      invoices_processed BIGINT, invoices_failed BIGINT, new_products BIGINT,
      waitlist_users BIGINT, deleted_users BIGINT, total_users BIGINT, standard_users BIGINT
    )
    SECURITY DEFINER SET search_path = public LANGUAGE sql STABLE
    AS $$
      SELECT
        (SELECT COUNT(*) FROM app_user WHERE created_at::date = p_date),
        (SELECT COUNT(DISTINCT tenant_id) FROM invoice WHERE created_at::date = p_date),
        (SELECT COUNT(DISTINCT tenant_id) FROM invoice
         WHERE created_at::date > p_date - 30 AND created_at::date <= p_date),
        (SELECT COUNT(*) FROM app_user WHERE role = 'PREMIUM'),
        (SELECT COUNT(*) FROM app_user WHERE status = 'ACTIVE'),
        (SELECT COUNT(*) FROM invoice_feedback WHERE created_at::date = p_date AND verdict = 'UP'),
        (SELECT COUNT(*) FROM invoice_feedback WHERE created_at::date = p_date),
        (SELECT COUNT(*) FROM invoice_feedback WHERE created_at::date = p_date AND verdict = 'DOWN'),
        (SELECT COUNT(*) FROM invoice
         WHERE created_at::date = p_date AND status IN ('PARSED', 'NEEDS_REVIEW')),
        (SELECT COUNT(*) FROM invoice
         WHERE created_at::date = p_date AND status = 'FAILED_PROCESSING'),
        (SELECT COUNT(*) FROM product WHERE created_at::date = p_date),
        (SELECT COUNT(*) FROM app_user WHERE status = 'WAITLIST'),
        (SELECT COUNT(*) FROM app_user WHERE status = 'DELETED'),
        (SELECT COUNT(*) FROM app_user),
        (SELECT COUNT(*) FROM app_user WHERE role = 'STANDARD');
    $$;
    REVOKE ALL ON FUNCTION admin_business_kpis(DATE) FROM PUBLIC;
  `);
}
