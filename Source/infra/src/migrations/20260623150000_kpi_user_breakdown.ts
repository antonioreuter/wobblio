import type { MigrationBuilder } from 'node-pg-migrate';

// Extends admin_business_kpis with the user-base breakdown: waitlist, deleted, total,
// and standard counts (premium + active already present). These are point-in-time
// totals (snapshot each day) — a trend of the user base, not per-day events.
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
        (SELECT COUNT(*) FROM app_user WHERE role = 'STANDARD')
`;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP FUNCTION IF EXISTS admin_business_kpis(DATE);
    CREATE FUNCTION admin_business_kpis(p_date DATE)
    RETURNS TABLE (
      registrations       BIGINT,
      dau                 BIGINT,
      mau                 BIGINT,
      premium_count       BIGINT,
      active_users        BIGINT,
      feedback_up         BIGINT,
      feedback_total      BIGINT,
      feedback_down       BIGINT,
      invoices_processed  BIGINT,
      invoices_failed     BIGINT,
      new_products        BIGINT,
      waitlist_users      BIGINT,
      deleted_users       BIGINT,
      total_users         BIGINT,
      standard_users      BIGINT
    )
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE sql
    STABLE
    AS $$ SELECT ${BODY}; $$;
    REVOKE ALL ON FUNCTION admin_business_kpis(DATE) FROM PUBLIC;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP FUNCTION IF EXISTS admin_business_kpis(DATE);
    CREATE FUNCTION admin_business_kpis(p_date DATE)
    RETURNS TABLE (
      registrations BIGINT, dau BIGINT, mau BIGINT, premium_count BIGINT,
      active_users BIGINT, feedback_up BIGINT, feedback_total BIGINT, feedback_down BIGINT,
      invoices_processed BIGINT, invoices_failed BIGINT, new_products BIGINT
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
        (SELECT COUNT(*) FROM product WHERE created_at::date = p_date);
    $$;
    REVOKE ALL ON FUNCTION admin_business_kpis(DATE) FROM PUBLIC;
  `);
}
