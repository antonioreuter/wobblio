import type { MigrationBuilder } from 'node-pg-migrate';

// Extends the Epic-15 business-KPI rollup with operational metrics the KPI dashboard
// needs: invoices processed / failed, feedback up / down counts, new products, and
// new merchants per country. merchant/product had no creation timestamp, so add one
// (existing rows default to the migration time — accurate only going forward).
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE merchant ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
    ALTER TABLE product  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

    -- Return type changes, so drop + recreate (CREATE OR REPLACE can't alter columns).
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
      new_products        BIGINT
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
        (SELECT COUNT(*) FROM invoice_feedback WHERE created_at::date = p_date),
        (SELECT COUNT(*) FROM invoice_feedback WHERE created_at::date = p_date AND verdict = 'DOWN'),
        (SELECT COUNT(*) FROM invoice
         WHERE created_at::date = p_date AND status IN ('PARSED', 'NEEDS_REVIEW')),
        (SELECT COUNT(*) FROM invoice
         WHERE created_at::date = p_date AND status = 'FAILED_PROCESSING'),
        (SELECT COUNT(*) FROM product WHERE created_at::date = p_date);
    $$;
    REVOKE ALL ON FUNCTION admin_business_kpis(DATE) FROM PUBLIC;

    -- New merchants per country for the day (one row per country).
    CREATE OR REPLACE FUNCTION admin_new_merchants_by_country(p_date DATE)
    RETURNS TABLE (country_code CHAR(2), cnt BIGINT)
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE sql
    STABLE
    AS $$
      SELECT country_code, COUNT(*)
      FROM merchant
      WHERE created_at::date = p_date
      GROUP BY country_code;
    $$;
    REVOKE ALL ON FUNCTION admin_new_merchants_by_country(DATE) FROM PUBLIC;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP FUNCTION IF EXISTS admin_new_merchants_by_country(DATE);
    DROP FUNCTION IF EXISTS admin_business_kpis(DATE);
    CREATE FUNCTION admin_business_kpis(p_date DATE)
    RETURNS TABLE (
      registrations  BIGINT, dau BIGINT, mau BIGINT, premium_count BIGINT,
      active_users BIGINT, feedback_up BIGINT, feedback_total BIGINT
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
        (SELECT COUNT(*) FROM invoice_feedback WHERE created_at::date = p_date);
    $$;
    REVOKE ALL ON FUNCTION admin_business_kpis(DATE) FROM PUBLIC;
    ALTER TABLE product  DROP COLUMN IF EXISTS created_at;
    ALTER TABLE merchant DROP COLUMN IF EXISTS created_at;
  `);
}
