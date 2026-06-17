import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- ── Budget alert history (when each threshold last fired) ────────────────────
    ALTER TABLE budget ADD COLUMN IF NOT EXISTS alert_85_at  TIMESTAMPTZ NULL;
    ALTER TABLE budget ADD COLUMN IF NOT EXISTS alert_100_at TIMESTAMPTZ NULL;

    -- ── In-app notifications (budget alerts), 3-day TTL ─────────────────────────
    CREATE TABLE notification (
      id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id  UUID        NOT NULL REFERENCES app_user(id),
      kind       TEXT        NOT NULL,
      title      TEXT        NOT NULL,
      body       TEXT        NOT NULL,
      budget_id  UUID        NULL REFERENCES budget(id) ON DELETE CASCADE,
      read_at    TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX notification_tenant_created_idx ON notification (tenant_id, created_at DESC);
    CREATE INDEX notification_expires_idx ON notification (expires_at);

    ALTER TABLE notification ENABLE ROW LEVEL SECURITY;
    CREATE POLICY tenant_isolation ON notification
      USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

    -- ── budget-recycler primitives (cron crosses all tenants → SECURITY DEFINER) ─
    CREATE OR REPLACE FUNCTION list_active_budgets()
    RETURNS TABLE (
      id UUID, tenant_id UUID, scope budget_scope, category_id TEXT, member_user_id UUID,
      amount NUMERIC, period budget_period, accumulated NUMERIC,
      alert_85_fired BOOLEAN, alert_100_fired BOOLEAN,
      alert_85_at TIMESTAMPTZ, alert_100_at TIMESTAMPTZ, cycle_start DATE,
      language TEXT, currency TEXT
    )
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE sql
    STABLE
    AS $$
      SELECT b.id, b.tenant_id, b.scope, b.category_id, b.member_user_id,
             b.amount, b.period, b.accumulated,
             b.alert_85_fired, b.alert_100_fired, b.alert_85_at, b.alert_100_at,
             b.cycle_start, u.language, u.home_currency
      FROM budget b
      JOIN app_user u ON u.id = b.tenant_id;
    $$;
    REVOKE ALL ON FUNCTION list_active_budgets() FROM PUBLIC;

    -- Spend in [p_from, p_to) attributed by transaction_date (fallback created_at),
    -- scoped by budget scope. MEMBER counts a member's uploads in the owner's household.
    CREATE OR REPLACE FUNCTION compute_budget_spend(
      p_tenant_id      UUID,
      p_scope          budget_scope,
      p_category_id    TEXT,
      p_member_user_id UUID,
      p_from           DATE,
      p_to             DATE
    )
    RETURNS NUMERIC
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE sql
    STABLE
    AS $$
      SELECT COALESCE(SUM(i.total), 0)
      FROM invoice i
      WHERE i.status IN ('PARSED', 'NEEDS_REVIEW')
        AND i.total IS NOT NULL
        AND COALESCE(i.transaction_date, i.created_at::date) >= p_from
        AND COALESCE(i.transaction_date, i.created_at::date) <  p_to
        AND CASE p_scope
          WHEN 'TOTAL'    THEN i.tenant_id = p_tenant_id
          WHEN 'CATEGORY' THEN i.tenant_id = p_tenant_id AND i.category_id = p_category_id
          WHEN 'MEMBER'   THEN i.uploaded_by_user_id = p_member_user_id
                               AND i.household_id IN (SELECT id FROM household WHERE owner_user_id = p_tenant_id)
          ELSE false
        END;
    $$;
    REVOKE ALL ON FUNCTION compute_budget_spend(UUID, budget_scope, TEXT, UUID, DATE, DATE) FROM PUBLIC;

    CREATE OR REPLACE FUNCTION save_budget_state(
      p_budget_id     UUID,
      p_accumulated   NUMERIC,
      p_alert_85      BOOLEAN,
      p_alert_85_at   TIMESTAMPTZ,
      p_alert_100     BOOLEAN,
      p_alert_100_at  TIMESTAMPTZ,
      p_cycle_start   DATE
    )
    RETURNS VOID
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE sql
    AS $$
      UPDATE budget
         SET accumulated     = p_accumulated,
             alert_85_fired  = p_alert_85,
             alert_85_at     = p_alert_85_at,
             alert_100_fired = p_alert_100,
             alert_100_at    = p_alert_100_at,
             cycle_start     = p_cycle_start
       WHERE id = p_budget_id;
    $$;
    REVOKE ALL ON FUNCTION save_budget_state(UUID, NUMERIC, BOOLEAN, TIMESTAMPTZ, BOOLEAN, TIMESTAMPTZ, DATE) FROM PUBLIC;

    -- Cross-tenant notification insert (cron) — explicit tenant_id, TTL in days.
    CREATE OR REPLACE FUNCTION insert_notification(
      p_tenant_id UUID,
      p_kind      TEXT,
      p_title     TEXT,
      p_body      TEXT,
      p_budget_id UUID,
      p_ttl_days  INT
    )
    RETURNS VOID
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE sql
    AS $$
      INSERT INTO notification (tenant_id, kind, title, body, budget_id, expires_at)
      VALUES (p_tenant_id, p_kind, p_title, p_body, p_budget_id, now() + make_interval(days => p_ttl_days));
    $$;
    REVOKE ALL ON FUNCTION insert_notification(UUID, TEXT, TEXT, TEXT, UUID, INT) FROM PUBLIC;

    CREATE OR REPLACE FUNCTION purge_expired_notifications()
    RETURNS INT
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_count INT;
    BEGIN
      WITH deleted AS (DELETE FROM notification WHERE expires_at <= now() RETURNING 1)
      SELECT count(*) INTO v_count FROM deleted;
      RETURN v_count;
    END;
    $$;
    REVOKE ALL ON FUNCTION purge_expired_notifications() FROM PUBLIC;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP FUNCTION IF EXISTS purge_expired_notifications();
    DROP FUNCTION IF EXISTS insert_notification(UUID, TEXT, TEXT, TEXT, UUID, INT);
    DROP FUNCTION IF EXISTS save_budget_state(UUID, NUMERIC, BOOLEAN, TIMESTAMPTZ, BOOLEAN, TIMESTAMPTZ, DATE);
    DROP FUNCTION IF EXISTS compute_budget_spend(UUID, budget_scope, TEXT, UUID, DATE, DATE);
    DROP FUNCTION IF EXISTS list_active_budgets();

    DROP TABLE IF EXISTS notification CASCADE;

    ALTER TABLE budget DROP COLUMN IF EXISTS alert_100_at;
    ALTER TABLE budget DROP COLUMN IF EXISTS alert_85_at;
  `);
}
