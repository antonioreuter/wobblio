import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- One current advisor card per tenant; replaced (not accumulated) each week (§10).
    CREATE TABLE weekly_advisor (
      tenant_id    UUID        PRIMARY KEY REFERENCES app_user(id),
      week_start   DATE        NOT NULL,
      body         TEXT        NOT NULL,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    ALTER TABLE weekly_advisor ENABLE ROW LEVEL SECURITY;
    CREATE POLICY tenant_isolation ON weekly_advisor
      USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

    -- ── weekly-advisor cron primitives (cross-tenant → SECURITY DEFINER) ────────
    -- Premium, active users with at least one parsed invoice since the week start.
    CREATE OR REPLACE FUNCTION list_advisor_eligible_tenants(p_week_start DATE)
    RETURNS TABLE (tenant_id UUID, language TEXT, currency TEXT)
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE sql
    STABLE
    AS $$
      SELECT u.id, u.language, u.home_currency
      FROM app_user u
      WHERE u.role = 'PREMIUM' AND u.status = 'ACTIVE'
        AND EXISTS (
          SELECT 1 FROM invoice i
          WHERE i.tenant_id = u.id
            AND i.created_at >= p_week_start
            AND i.status IN ('PARSED', 'NEEDS_REVIEW')
        );
    $$;
    REVOKE ALL ON FUNCTION list_advisor_eligible_tenants(DATE) FROM PUBLIC;

    CREATE OR REPLACE FUNCTION advisor_budgets(p_tenant_id UUID)
    RETURNS TABLE (scope budget_scope, amount NUMERIC, accumulated NUMERIC)
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE sql
    STABLE
    AS $$
      SELECT scope, amount, accumulated FROM budget WHERE tenant_id = p_tenant_id ORDER BY amount DESC;
    $$;
    REVOKE ALL ON FUNCTION advisor_budgets(UUID) FROM PUBLIC;

    -- Products where the cheapest k≥3 regional price beats the user's own average.
    CREATE OR REPLACE FUNCTION advisor_price_findings(p_tenant_id UUID, p_limit INT)
    RETURNS TABLE (
      product_name TEXT, your_price NUMERIC, cheapest_price NUMERIC,
      merchant_name TEXT, observation_count INT
    )
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE sql
    STABLE
    AS $$
      WITH region AS (SELECT region_code FROM app_user WHERE id = p_tenant_id),
      mine AS (
        SELECT l.product_id, avg(l.line_total / NULLIF(l.quantity, 0)) AS your_price
        FROM invoice_line l
        JOIN invoice i ON i.id = l.invoice_id
        WHERE i.tenant_id = p_tenant_id AND l.product_id IS NOT NULL
          AND i.status IN ('PARSED', 'NEEDS_REVIEW')
        GROUP BY l.product_id
      ),
      regional AS (
        SELECT po.product_id, po.merchant_id,
               percentile_cont(0.5) WITHIN GROUP (ORDER BY po.pack_price) AS price,
               count(*) AS obs
        FROM price_observation po, region r
        WHERE po.region_code = r.region_code AND po.quarantined = false
        GROUP BY po.product_id, po.merchant_id
        HAVING count(*) >= 3
      ),
      cheapest AS (
        -- Deterministic tie-break: cheapest, then most-observed, then stable merchant id.
        SELECT DISTINCT ON (product_id) product_id, merchant_id, price, obs
        FROM regional ORDER BY product_id, price ASC, obs DESC, merchant_id ASC
      )
      SELECT p.display_name, mine.your_price, c.price, m.brand_name, c.obs::int
      FROM mine
      JOIN cheapest c ON c.product_id = mine.product_id
      JOIN product p ON p.id = mine.product_id
      JOIN merchant m ON m.id = c.merchant_id
      WHERE c.price < mine.your_price
      ORDER BY (mine.your_price - c.price) DESC
      LIMIT p_limit;
    $$;
    REVOKE ALL ON FUNCTION advisor_price_findings(UUID, INT) FROM PUBLIC;

    CREATE OR REPLACE FUNCTION save_weekly_advisor(p_tenant_id UUID, p_week_start DATE, p_body TEXT)
    RETURNS VOID
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE sql
    AS $$
      INSERT INTO weekly_advisor (tenant_id, week_start, body, generated_at)
      VALUES (p_tenant_id, p_week_start, p_body, now())
      ON CONFLICT (tenant_id)
      DO UPDATE SET week_start = EXCLUDED.week_start, body = EXCLUDED.body, generated_at = now();
    $$;
    REVOKE ALL ON FUNCTION save_weekly_advisor(UUID, DATE, TEXT) FROM PUBLIC;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP FUNCTION IF EXISTS save_weekly_advisor(UUID, DATE, TEXT);
    DROP FUNCTION IF EXISTS advisor_price_findings(UUID, INT);
    DROP FUNCTION IF EXISTS advisor_budgets(UUID);
    DROP FUNCTION IF EXISTS list_advisor_eligible_tenants(DATE);
    DROP TABLE IF EXISTS weekly_advisor CASCADE;
  `);
}
