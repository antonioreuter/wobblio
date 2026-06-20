import type { MigrationBuilder } from 'node-pg-migrate';

// Teach compute_budget_spend the HOUSEHOLD scope: sum every member's
// household-space invoices for households owned by the budget tenant, with an
// optional category filter (NULL = all spending). Mirrors how the MEMBER branch
// resolves households from p_tenant_id. TOTAL/CATEGORY stay personal.
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

// Restore the pre-HOUSEHOLD three-branch body.
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
          WHEN 'TOTAL'    THEN i.tenant_id = p_tenant_id
          WHEN 'CATEGORY' THEN i.tenant_id = p_tenant_id AND i.category_id = p_category_id
          WHEN 'MEMBER'   THEN i.uploaded_by_user_id = p_member_user_id
                               AND i.household_id IN (SELECT id FROM household WHERE owner_user_id = p_tenant_id)
          ELSE false
        END;
    $$;
    REVOKE ALL ON FUNCTION compute_budget_spend(UUID, budget_scope, TEXT, UUID, DATE, DATE) FROM PUBLIC;
  `);
}
