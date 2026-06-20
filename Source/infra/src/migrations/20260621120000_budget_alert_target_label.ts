import type { MigrationBuilder } from 'node-pg-migrate';

// Budget alert copy must name the specific budget (e.g. "Groceries"), not just the
// scope ("category"). Add a localized target_label to the budget-listing functions:
// category name for CATEGORY/HOUSEHOLD, member name for MEMBER, NULL otherwise.
// Return-shape change → DROP + CREATE (CREATE OR REPLACE can't add a column).

const LABEL = `
  CASE b.scope
    WHEN 'CATEGORY'  THEN (SELECT CASE WHEN u.language = 'nl' THEN COALESCE(pc.name_nl, pc.name) ELSE pc.name END
                             FROM product_category pc WHERE pc.id = b.category_id)
    WHEN 'HOUSEHOLD' THEN (SELECT CASE WHEN u.language = 'nl' THEN COALESCE(pc.name_nl, pc.name) ELSE pc.name END
                             FROM product_category pc WHERE pc.id = b.category_id)
    WHEN 'MEMBER'    THEN (SELECT COALESCE(NULLIF(mu.full_name, ''), mu.email)
                             FROM app_user mu WHERE mu.id = b.member_user_id)
    ELSE NULL
  END`;

const RETURN_COLS = `
  id UUID, tenant_id UUID, scope budget_scope, category_id TEXT, member_user_id UUID,
  target_label TEXT, amount NUMERIC, period budget_period, accumulated NUMERIC,
  alert_85_fired BOOLEAN, alert_100_fired BOOLEAN,
  alert_85_at TIMESTAMPTZ, alert_100_at TIMESTAMPTZ, cycle_start DATE,
  language TEXT, currency TEXT`;

const SELECT_COLS = `
  b.id, b.tenant_id, b.scope, b.category_id, b.member_user_id,
  ${LABEL} AS target_label, b.amount, b.period, b.accumulated,
  b.alert_85_fired, b.alert_100_fired, b.alert_85_at, b.alert_100_at,
  b.cycle_start, u.language, u.home_currency`;

const RETURN_COLS_OLD = `
  id UUID, tenant_id UUID, scope budget_scope, category_id TEXT, member_user_id UUID,
  amount NUMERIC, period budget_period, accumulated NUMERIC,
  alert_85_fired BOOLEAN, alert_100_fired BOOLEAN,
  alert_85_at TIMESTAMPTZ, alert_100_at TIMESTAMPTZ, cycle_start DATE,
  language TEXT, currency TEXT`;

const SELECT_COLS_OLD = `
  b.id, b.tenant_id, b.scope, b.category_id, b.member_user_id,
  b.amount, b.period, b.accumulated,
  b.alert_85_fired, b.alert_100_fired, b.alert_85_at, b.alert_100_at,
  b.cycle_start, u.language, u.home_currency`;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP FUNCTION IF EXISTS list_active_budgets();
    CREATE FUNCTION list_active_budgets()
    RETURNS TABLE (${RETURN_COLS})
    SECURITY DEFINER SET search_path = public LANGUAGE sql STABLE
    AS $$
      SELECT ${SELECT_COLS}
      FROM budget b JOIN app_user u ON u.id = b.tenant_id;
    $$;
    REVOKE ALL ON FUNCTION list_active_budgets() FROM PUBLIC;

    DROP FUNCTION IF EXISTS list_active_budgets_for_invoice(UUID);
    CREATE FUNCTION list_active_budgets_for_invoice(p_invoice_id UUID)
    RETURNS TABLE (${RETURN_COLS})
    SECURITY DEFINER SET search_path = public LANGUAGE sql STABLE
    AS $$
      SELECT ${SELECT_COLS}
      FROM budget b JOIN app_user u ON u.id = b.tenant_id
      WHERE b.tenant_id = (SELECT uploaded_by_user_id FROM invoice WHERE id = p_invoice_id)
         OR b.tenant_id = (SELECT h.owner_user_id FROM invoice i
                             JOIN household h ON h.id = i.household_id WHERE i.id = p_invoice_id);
    $$;
    REVOKE ALL ON FUNCTION list_active_budgets_for_invoice(UUID) FROM PUBLIC;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP FUNCTION IF EXISTS list_active_budgets();
    CREATE FUNCTION list_active_budgets()
    RETURNS TABLE (${RETURN_COLS_OLD})
    SECURITY DEFINER SET search_path = public LANGUAGE sql STABLE
    AS $$
      SELECT ${SELECT_COLS_OLD}
      FROM budget b JOIN app_user u ON u.id = b.tenant_id;
    $$;
    REVOKE ALL ON FUNCTION list_active_budgets() FROM PUBLIC;

    DROP FUNCTION IF EXISTS list_active_budgets_for_invoice(UUID);
    CREATE FUNCTION list_active_budgets_for_invoice(p_invoice_id UUID)
    RETURNS TABLE (${RETURN_COLS_OLD})
    SECURITY DEFINER SET search_path = public LANGUAGE sql STABLE
    AS $$
      SELECT ${SELECT_COLS_OLD}
      FROM budget b JOIN app_user u ON u.id = b.tenant_id
      WHERE b.tenant_id = (SELECT uploaded_by_user_id FROM invoice WHERE id = p_invoice_id)
         OR b.tenant_id = (SELECT h.owner_user_id FROM invoice i
                             JOIN household h ON h.id = i.household_id WHERE i.id = p_invoice_id);
    $$;
    REVOKE ALL ON FUNCTION list_active_budgets_for_invoice(UUID) FROM PUBLIC;
  `);
}
