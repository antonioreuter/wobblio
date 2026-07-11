import type { MigrationBuilder } from 'node-pg-migrate';

// Convert compute_budget_spend to home currency. Previously it summed i.total raw,
// so a foreign receipt (e.g. R$ 928,00) was added to the budget as if it were 928
// in the owner's home currency. Now each invoice is converted via its frozen
// per-invoice rate (i.total * COALESCE(i.fx_rate_used, 1)) and a currency gate keeps
// only rows that can be honestly valued in the owner's home currency: fx_rate_used
// set (converted at ingestion), already in home currency, or legacy rows with no
// currency stamped (treated as home/face value so pre-FX totals don't shrink).
// Body is otherwise identical to 20260620131000 — same scope CASE incl. HOUSEHOLD.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
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
      SELECT COALESCE(SUM(i.total * COALESCE(i.fx_rate_used, 1)), 0)
      FROM invoice i
      WHERE i.status IN ('PARSED', 'NEEDS_REVIEW')
        AND i.total IS NOT NULL
        AND (
          i.fx_rate_used IS NOT NULL
          OR i.currency = (SELECT home_currency FROM app_user WHERE id = p_tenant_id)
          OR i.currency IS NULL
        )
        AND COALESCE(i.transaction_date, i.created_at::date) >= p_from
        AND COALESCE(i.transaction_date, i.created_at::date) <  p_to
        AND CASE p_scope
          WHEN 'TOTAL'     THEN i.tenant_id = p_tenant_id
          WHEN 'CATEGORY'  THEN i.tenant_id = p_tenant_id AND i.category_id = p_category_id
          WHEN 'MEMBER'    THEN i.uploaded_by_user_id = p_member_user_id
                                AND i.household_id IN (SELECT id FROM household WHERE owner_user_id = p_tenant_id)
          WHEN 'HOUSEHOLD' THEN i.household_id IN (SELECT id FROM household WHERE owner_user_id = p_tenant_id)
                                AND (p_category_id IS NULL OR i.category_id = p_category_id)
          ELSE false
        END;
    $$;
    REVOKE ALL ON FUNCTION compute_budget_spend(UUID, budget_scope, TEXT, UUID, DATE, DATE) FROM PUBLIC;
  `);
}

// Restore the pre-conversion body (raw SUM(i.total), no currency gate).
export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
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
          WHEN 'TOTAL'     THEN i.tenant_id = p_tenant_id
          WHEN 'CATEGORY'  THEN i.tenant_id = p_tenant_id AND i.category_id = p_category_id
          WHEN 'MEMBER'    THEN i.uploaded_by_user_id = p_member_user_id
                                AND i.household_id IN (SELECT id FROM household WHERE owner_user_id = p_tenant_id)
          WHEN 'HOUSEHOLD' THEN i.household_id IN (SELECT id FROM household WHERE owner_user_id = p_tenant_id)
                                AND (p_category_id IS NULL OR i.category_id = p_category_id)
          ELSE false
        END;
    $$;
    REVOKE ALL ON FUNCTION compute_budget_spend(UUID, budget_scope, TEXT, UUID, DATE, DATE) FROM PUBLIC;
  `);
}
