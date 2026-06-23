import type { MigrationBuilder } from 'node-pg-migrate';

// Curation queue v2 (admin-console): the provisional queues become server-side
// filtered (country + optional region + category), sorted, and paginated, plus facet
// helpers that drive the mandatory country selector and the per-category pie. Replaces
// the parameterless helpers from 20260623160000. Products are filtered on the new
// product.country_code (20260623170000); merchants on merchant.country_code. Region
// (optional) is matched through non-quarantined price_observation. A '__UNCAT__'
// category sentinel selects entities with no category. All SECURITY DEFINER (the
// counts span RLS-protected invoice rows), REVOKEd from PUBLIC.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP FUNCTION IF EXISTS admin_provisional_merchants();
    DROP FUNCTION IF EXISTS admin_provisional_products();

    -- ── Merchants: filtered + paginated list ──────────────────────────────────
    CREATE FUNCTION admin_provisional_merchants(
      p_country CHAR(2), p_region TEXT, p_category TEXT, p_sort TEXT, p_limit INT, p_offset INT
    )
    RETURNS TABLE (
      id UUID, name TEXT, subtitle CHAR(2), category TEXT, aliases TEXT[],
      tenant_count BIGINT, observation_count BIGINT, last_seen_on DATE
    )
    SECURITY DEFINER SET search_path = public LANGUAGE sql STABLE AS $$
      SELECT
        m.id, m.brand_name, m.country_code,
        (SELECT pc.name FROM product_category pc WHERE pc.id = m.default_category_id) AS category,
        COALESCE((SELECT array_agg(DISTINCT a.alias_raw) FROM merchant_alias a
          WHERE a.merchant_id = m.id AND a.alias_raw IS NOT NULL), '{}') AS aliases,
        (SELECT COUNT(DISTINCT i.tenant_id) FROM invoice i WHERE i.merchant_id = m.id) AS tenant_count,
        (SELECT COUNT(*) FROM price_observation po WHERE po.merchant_id = m.id AND po.quarantined = false) AS observation_count,
        (SELECT MAX(po.observed_on) FROM price_observation po WHERE po.merchant_id = m.id AND po.quarantined = false) AS last_seen_on
      FROM merchant m
      WHERE m.status = 'PROVISIONAL'
        AND m.country_code = p_country
        AND (p_category IS NULL
             OR (p_category = '__UNCAT__' AND m.default_category_id IS NULL)
             OR m.default_category_id = p_category)
        AND (p_region IS NULL OR EXISTS (
          SELECT 1 FROM price_observation po
          WHERE po.merchant_id = m.id AND po.quarantined = false AND po.region_code = p_region))
      ORDER BY
        CASE WHEN p_sort = 'name' THEN m.brand_name END ASC,
        CASE WHEN p_sort = 'date' THEN
          (SELECT MAX(po.observed_on) FROM price_observation po WHERE po.merchant_id = m.id AND po.quarantined = false)
        END DESC NULLS LAST,
        tenant_count DESC, observation_count DESC
      LIMIT p_limit OFFSET p_offset;
    $$;
    REVOKE ALL ON FUNCTION admin_provisional_merchants(CHAR(2), TEXT, TEXT, TEXT, INT, INT) FROM PUBLIC;

    -- ── Products: filtered + paginated list ───────────────────────────────────
    CREATE FUNCTION admin_provisional_products(
      p_country CHAR(2), p_region TEXT, p_category TEXT, p_sort TEXT, p_limit INT, p_offset INT
    )
    RETURNS TABLE (
      id UUID, name TEXT, subtitle TEXT, category TEXT, aliases TEXT[],
      tenant_count BIGINT, observation_count BIGINT, last_seen_on DATE
    )
    SECURITY DEFINER SET search_path = public LANGUAGE sql STABLE AS $$
      SELECT
        p.id, p.display_name, p.brand,
        (SELECT pc.name FROM product_category pc WHERE pc.id = p.category_id) AS category,
        COALESCE((SELECT array_agg(DISTINCT pa.alias_normalized) FROM product_alias pa
          WHERE pa.product_id = p.id), '{}') AS aliases,
        (SELECT COUNT(DISTINCT il_inv.tenant_id) FROM invoice_line il
          JOIN invoice il_inv ON il_inv.id = il.invoice_id WHERE il.product_id = p.id) AS tenant_count,
        (SELECT COUNT(*) FROM price_observation po WHERE po.product_id = p.id AND po.quarantined = false) AS observation_count,
        (SELECT MAX(po.observed_on) FROM price_observation po WHERE po.product_id = p.id AND po.quarantined = false) AS last_seen_on
      FROM product p
      WHERE p.status = 'PROVISIONAL'
        AND p.country_code = p_country
        AND (p_category IS NULL
             OR (p_category = '__UNCAT__' AND p.category_id IS NULL)
             OR p.category_id = p_category)
        AND (p_region IS NULL OR EXISTS (
          SELECT 1 FROM price_observation po
          WHERE po.product_id = p.id AND po.quarantined = false AND po.region_code = p_region))
      ORDER BY
        CASE WHEN p_sort = 'name' THEN p.display_name END ASC,
        CASE WHEN p_sort = 'date' THEN
          (SELECT MAX(po.observed_on) FROM price_observation po WHERE po.product_id = p.id AND po.quarantined = false)
        END DESC NULLS LAST,
        tenant_count DESC, observation_count DESC
      LIMIT p_limit OFFSET p_offset;
    $$;
    REVOKE ALL ON FUNCTION admin_provisional_products(CHAR(2), TEXT, TEXT, TEXT, INT, INT) FROM PUBLIC;

    -- ── Facets: country counts (mandatory country selector) ───────────────────
    CREATE FUNCTION admin_provisional_merchant_countries()
    RETURNS TABLE (country_code CHAR(2), cnt BIGINT)
    SECURITY DEFINER SET search_path = public LANGUAGE sql STABLE AS $$
      SELECT m.country_code, COUNT(*) FROM merchant m
      WHERE m.status = 'PROVISIONAL' AND m.country_code IS NOT NULL
      GROUP BY m.country_code ORDER BY COUNT(*) DESC;
    $$;
    REVOKE ALL ON FUNCTION admin_provisional_merchant_countries() FROM PUBLIC;

    CREATE FUNCTION admin_provisional_product_countries()
    RETURNS TABLE (country_code CHAR(2), cnt BIGINT)
    SECURITY DEFINER SET search_path = public LANGUAGE sql STABLE AS $$
      SELECT p.country_code, COUNT(*) FROM product p
      WHERE p.status = 'PROVISIONAL' AND p.country_code IS NOT NULL
      GROUP BY p.country_code ORDER BY COUNT(*) DESC;
    $$;
    REVOKE ALL ON FUNCTION admin_provisional_product_countries() FROM PUBLIC;

    -- ── Facets: category counts within a country [+region] (the pie) ──────────
    CREATE FUNCTION admin_provisional_merchant_categories(p_country CHAR(2), p_region TEXT)
    RETURNS TABLE (category_id TEXT, category_name TEXT, cnt BIGINT)
    SECURITY DEFINER SET search_path = public LANGUAGE sql STABLE AS $$
      SELECT COALESCE(m.default_category_id, '__UNCAT__') AS category_id,
             COALESCE((SELECT pc.name FROM product_category pc WHERE pc.id = m.default_category_id), 'Uncategorized') AS category_name,
             COUNT(*)
      FROM merchant m
      WHERE m.status = 'PROVISIONAL' AND m.country_code = p_country
        AND (p_region IS NULL OR EXISTS (
          SELECT 1 FROM price_observation po
          WHERE po.merchant_id = m.id AND po.quarantined = false AND po.region_code = p_region))
      GROUP BY m.default_category_id ORDER BY COUNT(*) DESC;
    $$;
    REVOKE ALL ON FUNCTION admin_provisional_merchant_categories(CHAR(2), TEXT) FROM PUBLIC;

    CREATE FUNCTION admin_provisional_product_categories(p_country CHAR(2), p_region TEXT)
    RETURNS TABLE (category_id TEXT, category_name TEXT, cnt BIGINT)
    SECURITY DEFINER SET search_path = public LANGUAGE sql STABLE AS $$
      SELECT COALESCE(p.category_id, '__UNCAT__') AS category_id,
             COALESCE((SELECT pc.name FROM product_category pc WHERE pc.id = p.category_id), 'Uncategorized') AS category_name,
             COUNT(*)
      FROM product p
      WHERE p.status = 'PROVISIONAL' AND p.country_code = p_country
        AND (p_region IS NULL OR EXISTS (
          SELECT 1 FROM price_observation po
          WHERE po.product_id = p.id AND po.quarantined = false AND po.region_code = p_region))
      GROUP BY p.category_id ORDER BY COUNT(*) DESC;
    $$;
    REVOKE ALL ON FUNCTION admin_provisional_product_categories(CHAR(2), TEXT) FROM PUBLIC;

    -- ── Facets: region list within a country (optional region selector) ───────
    CREATE FUNCTION admin_provisional_merchant_regions(p_country CHAR(2))
    RETURNS TABLE (region_code TEXT, cnt BIGINT)
    SECURITY DEFINER SET search_path = public LANGUAGE sql STABLE AS $$
      SELECT po.region_code, COUNT(DISTINCT m.id)
      FROM merchant m
      JOIN price_observation po ON po.merchant_id = m.id AND po.quarantined = false
      WHERE m.status = 'PROVISIONAL' AND m.country_code = p_country AND po.region_code IS NOT NULL
      GROUP BY po.region_code ORDER BY COUNT(DISTINCT m.id) DESC;
    $$;
    REVOKE ALL ON FUNCTION admin_provisional_merchant_regions(CHAR(2)) FROM PUBLIC;

    CREATE FUNCTION admin_provisional_product_regions(p_country CHAR(2))
    RETURNS TABLE (region_code TEXT, cnt BIGINT)
    SECURITY DEFINER SET search_path = public LANGUAGE sql STABLE AS $$
      SELECT po.region_code, COUNT(DISTINCT p.id)
      FROM product p
      JOIN price_observation po ON po.product_id = p.id AND po.quarantined = false
      WHERE p.status = 'PROVISIONAL' AND p.country_code = p_country AND po.region_code IS NOT NULL
      GROUP BY po.region_code ORDER BY COUNT(DISTINCT p.id) DESC;
    $$;
    REVOKE ALL ON FUNCTION admin_provisional_product_regions(CHAR(2)) FROM PUBLIC;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP FUNCTION IF EXISTS admin_provisional_merchants(CHAR(2), TEXT, TEXT, TEXT, INT, INT);
    DROP FUNCTION IF EXISTS admin_provisional_products(CHAR(2), TEXT, TEXT, TEXT, INT, INT);
    DROP FUNCTION IF EXISTS admin_provisional_merchant_countries();
    DROP FUNCTION IF EXISTS admin_provisional_product_countries();
    DROP FUNCTION IF EXISTS admin_provisional_merchant_categories(CHAR(2), TEXT);
    DROP FUNCTION IF EXISTS admin_provisional_product_categories(CHAR(2), TEXT);
    DROP FUNCTION IF EXISTS admin_provisional_merchant_regions(CHAR(2));
    DROP FUNCTION IF EXISTS admin_provisional_product_regions(CHAR(2));

    -- Restore the parameterless queue helpers (20260623160000).
    CREATE OR REPLACE FUNCTION admin_provisional_merchants()
    RETURNS TABLE (id UUID, name TEXT, country_code CHAR(2), category TEXT, aliases TEXT[], tenant_count BIGINT, observation_count BIGINT, last_seen_on DATE)
    SECURITY DEFINER SET search_path = public LANGUAGE sql STABLE AS $$
      SELECT m.id, m.brand_name, m.country_code,
        (SELECT pc.name FROM product_category pc WHERE pc.id = m.default_category_id),
        COALESCE((SELECT array_agg(DISTINCT a.alias_raw) FROM merchant_alias a WHERE a.merchant_id = m.id AND a.alias_raw IS NOT NULL), '{}'),
        (SELECT COUNT(DISTINCT i.tenant_id) FROM invoice i WHERE i.merchant_id = m.id),
        (SELECT COUNT(*) FROM price_observation po WHERE po.merchant_id = m.id AND po.quarantined = false),
        (SELECT MAX(po.observed_on) FROM price_observation po WHERE po.merchant_id = m.id AND po.quarantined = false)
      FROM merchant m WHERE m.status = 'PROVISIONAL' ORDER BY tenant_count DESC, observation_count DESC;
    $$;
    REVOKE ALL ON FUNCTION admin_provisional_merchants() FROM PUBLIC;

    CREATE OR REPLACE FUNCTION admin_provisional_products()
    RETURNS TABLE (id UUID, name TEXT, brand TEXT, category TEXT, aliases TEXT[], tenant_count BIGINT, observation_count BIGINT, last_seen_on DATE)
    SECURITY DEFINER SET search_path = public LANGUAGE sql STABLE AS $$
      SELECT p.id, p.display_name, p.brand,
        (SELECT pc.name FROM product_category pc WHERE pc.id = p.category_id),
        COALESCE((SELECT array_agg(DISTINCT pa.alias_normalized) FROM product_alias pa WHERE pa.product_id = p.id), '{}'),
        (SELECT COUNT(DISTINCT il_inv.tenant_id) FROM invoice_line il JOIN invoice il_inv ON il_inv.id = il.invoice_id WHERE il.product_id = p.id),
        (SELECT COUNT(*) FROM price_observation po WHERE po.product_id = p.id AND po.quarantined = false),
        (SELECT MAX(po.observed_on) FROM price_observation po WHERE po.product_id = p.id AND po.quarantined = false)
      FROM product p WHERE p.status = 'PROVISIONAL' ORDER BY tenant_count DESC, observation_count DESC;
    $$;
    REVOKE ALL ON FUNCTION admin_provisional_products() FROM PUBLIC;
  `);
}
