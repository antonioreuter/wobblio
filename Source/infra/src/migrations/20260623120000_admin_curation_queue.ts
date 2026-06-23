import type { MigrationBuilder } from 'node-pg-migrate';

// Admin alias-curation queue (admin-console 06). The sort key — "how many tenants
// are waiting on this provisional entity" — needs a cross-tenant count over the
// RLS-protected invoice / invoice_line tables, so it lives in SECURITY DEFINER
// helpers (same mechanism as the waitlist / held-invoice helpers). price_observation
// carries no tenant ref (de-identified, §6.5), so tenant_count comes from invoice;
// observation_count is the §6.8 corroboration signal (non-quarantined rows) compared
// to the k≥3 quorum in the app layer. Scalar subqueries avoid a join explosion.
//
// No REJECTED status exists (enum is PROVISIONAL/ACTIVE/INACTIVE); the admin "reject"
// action maps to INACTIVE — decided in admin-console/06. Promotion to ACTIVE / merge /
// reject are plain UPDATEs on the global catalog tables, done in the adapter.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION admin_provisional_merchants()
    RETURNS TABLE (
      id UUID,
      name TEXT,
      country_code CHAR(2),
      aliases TEXT[],
      tenant_count BIGINT,
      observation_count BIGINT
    )
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE sql
    STABLE
    AS $$
      SELECT
        m.id,
        m.brand_name,
        m.country_code,
        COALESCE(
          (SELECT array_agg(DISTINCT a.alias_raw)
           FROM merchant_alias a
           WHERE a.merchant_id = m.id AND a.alias_raw IS NOT NULL),
          '{}'
        ) AS aliases,
        (SELECT COUNT(DISTINCT i.tenant_id) FROM invoice i WHERE i.merchant_id = m.id) AS tenant_count,
        (SELECT COUNT(*) FROM price_observation po
         WHERE po.merchant_id = m.id AND po.quarantined = false) AS observation_count
      FROM merchant m
      WHERE m.status = 'PROVISIONAL'
      ORDER BY tenant_count DESC, observation_count DESC;
    $$;
    REVOKE ALL ON FUNCTION admin_provisional_merchants() FROM PUBLIC;

    CREATE OR REPLACE FUNCTION admin_provisional_products()
    RETURNS TABLE (
      id UUID,
      name TEXT,
      brand TEXT,
      aliases TEXT[],
      tenant_count BIGINT,
      observation_count BIGINT
    )
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE sql
    STABLE
    AS $$
      SELECT
        p.id,
        p.display_name,
        p.brand,
        COALESCE(
          (SELECT array_agg(DISTINCT pa.alias_normalized)
           FROM product_alias pa
           WHERE pa.product_id = p.id),
          '{}'
        ) AS aliases,
        (SELECT COUNT(DISTINCT il_inv.tenant_id)
         FROM invoice_line il
         JOIN invoice il_inv ON il_inv.id = il.invoice_id
         WHERE il.product_id = p.id) AS tenant_count,
        (SELECT COUNT(*) FROM price_observation po
         WHERE po.product_id = p.id AND po.quarantined = false) AS observation_count
      FROM product p
      WHERE p.status = 'PROVISIONAL'
      ORDER BY tenant_count DESC, observation_count DESC;
    $$;
    REVOKE ALL ON FUNCTION admin_provisional_products() FROM PUBLIC;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP FUNCTION IF EXISTS admin_provisional_merchants();
    DROP FUNCTION IF EXISTS admin_provisional_products();
  `);
}
