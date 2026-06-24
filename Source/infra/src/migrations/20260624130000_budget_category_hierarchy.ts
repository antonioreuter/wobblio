import type { MigrationBuilder } from 'node-pg-migrate';

// Budget CATEGORY scope now matches both exact macro category IDs and any invoices
// tagged with sub-category IDs (which have a parent_id pointing to the macro).
// This prevents invoices from invisibly disappearing from budget tracking when
// they are tagged with sub-categories (e.g., cat-dairy instead of cat-groceries).
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
          WHEN 'CATEGORY'  THEN i.tenant_id = p_tenant_id
                                AND (i.category_id = p_category_id
                                     OR EXISTS (SELECT 1 FROM product_category pc
                                                WHERE pc.id = i.category_id AND pc.parent_id = p_category_id))
          WHEN 'MEMBER'    THEN i.uploaded_by_user_id = p_member_user_id
                                AND i.household_id IN (SELECT id FROM household WHERE owner_user_id = p_tenant_id)
          WHEN 'HOUSEHOLD' THEN i.household_id IN (SELECT id FROM household WHERE owner_user_id = p_tenant_id)
                                AND (p_category_id IS NULL OR i.category_id = p_category_id
                                     OR EXISTS (SELECT 1 FROM product_category pc
                                                WHERE pc.id = i.category_id AND pc.parent_id = p_category_id))
          ELSE false
        END;
    $$;
    REVOKE ALL ON FUNCTION compute_budget_spend(UUID, budget_scope, TEXT, UUID, DATE, DATE) FROM PUBLIC;
  `);
}

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
          WHEN 'HOUSEHOLD' THEN i.household_id IN (SELECT id FROM household WHERE owner_user_id = p_tenant_id)
                                AND (p_category_id IS NULL OR i.category_id = p_category_id)
          ELSE false
        END;
    $$;
    REVOKE ALL ON FUNCTION compute_budget_spend(UUID, budget_scope, TEXT, UUID, DATE, DATE) FROM PUBLIC;
  `);
}
