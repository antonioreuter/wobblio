import type { MigrationBuilder } from 'node-pg-migrate';

// Adds the invoice-feedback breakdown to admin_business_kpis: of the invoices
// uploaded that day that reached a processed status, how many have positive,
// negative, or no feedback. (These three sum to invoices_processed.) Feeds the
// dashboard's feedback stats and the composite Operational-Efficiency KPI.
const PROCESSED = "i.status IN ('PARSED', 'NEEDS_REVIEW')";

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
        (SELECT COUNT(*) FROM invoice WHERE created_at::date = p_date AND status IN ('PARSED', 'NEEDS_REVIEW')),
        (SELECT COUNT(*) FROM invoice WHERE created_at::date = p_date AND status = 'FAILED_PROCESSING'),
        (SELECT COUNT(*) FROM product WHERE created_at::date = p_date),
        (SELECT COUNT(*) FROM app_user WHERE status = 'WAITLIST'),
        (SELECT COUNT(*) FROM app_user WHERE status = 'DELETED'),
        (SELECT COUNT(*) FROM app_user),
        (SELECT COUNT(*) FROM app_user WHERE role = 'STANDARD'),
        (SELECT COUNT(*) FROM invoice WHERE status = 'PROCESSING'),
        (SELECT COUNT(*) FROM tenant_trust WHERE trust_score < 30),
        (SELECT COUNT(*) FROM invoice i WHERE i.created_at::date = p_date AND ${PROCESSED}
           AND EXISTS (SELECT 1 FROM invoice_feedback f WHERE f.invoice_id = i.id AND f.verdict = 'UP')),
        (SELECT COUNT(*) FROM invoice i WHERE i.created_at::date = p_date AND ${PROCESSED}
           AND EXISTS (SELECT 1 FROM invoice_feedback f WHERE f.invoice_id = i.id AND f.verdict = 'DOWN')),
        (SELECT COUNT(*) FROM invoice i WHERE i.created_at::date = p_date AND ${PROCESSED}
           AND NOT EXISTS (SELECT 1 FROM invoice_feedback f WHERE f.invoice_id = i.id))
`;

const COLUMNS = `
      registrations BIGINT, dau BIGINT, mau BIGINT, premium_count BIGINT, active_users BIGINT,
      feedback_up BIGINT, feedback_total BIGINT, feedback_down BIGINT,
      invoices_processed BIGINT, invoices_failed BIGINT, new_products BIGINT,
      waitlist_users BIGINT, deleted_users BIGINT, total_users BIGINT, standard_users BIGINT,
      invoices_pending BIGINT, users_low_score BIGINT,
      invoices_feedback_positive BIGINT, invoices_feedback_negative BIGINT, invoices_feedback_none BIGINT
`;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP FUNCTION IF EXISTS admin_business_kpis(DATE);
    CREATE FUNCTION admin_business_kpis(p_date DATE)
    RETURNS TABLE (${COLUMNS})
    SECURITY DEFINER SET search_path = public LANGUAGE sql STABLE
    AS $$ SELECT ${BODY}; $$;
    REVOKE ALL ON FUNCTION admin_business_kpis(DATE) FROM PUBLIC;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
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
        (SELECT COUNT(*) FROM invoice WHERE created_at::date = p_date AND status IN ('PARSED', 'NEEDS_REVIEW')),
        (SELECT COUNT(*) FROM invoice WHERE created_at::date = p_date AND status = 'FAILED_PROCESSING'),
        (SELECT COUNT(*) FROM product WHERE created_at::date = p_date),
        (SELECT COUNT(*) FROM app_user WHERE status = 'WAITLIST'),
        (SELECT COUNT(*) FROM app_user WHERE status = 'DELETED'),
        (SELECT COUNT(*) FROM app_user),
        (SELECT COUNT(*) FROM app_user WHERE role = 'STANDARD'),
        (SELECT COUNT(*) FROM invoice WHERE status = 'PROCESSING'),
        (SELECT COUNT(*) FROM tenant_trust WHERE trust_score < 30);
    $$;
    REVOKE ALL ON FUNCTION admin_business_kpis(DATE) FROM PUBLIC;
  `);
}
