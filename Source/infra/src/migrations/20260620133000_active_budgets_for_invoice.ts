import type { MigrationBuilder } from 'node-pg-migrate';

// Event-driven budget alerting: after an invoice is parsed, the ingestion worker
// re-evaluates only the budgets that invoice can affect — the uploader's own
// budgets plus the owner's budgets for the invoice's household. SECURITY DEFINER
// so the worker (running as the uploader's tenant) can read cross-tenant household
// budgets, mirroring list_active_budgets().
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION list_active_budgets_for_invoice(p_invoice_id UUID)
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
      JOIN app_user u ON u.id = b.tenant_id
      WHERE b.tenant_id = (SELECT uploaded_by_user_id FROM invoice WHERE id = p_invoice_id)
         OR b.tenant_id = (SELECT h.owner_user_id
                             FROM invoice i
                             JOIN household h ON h.id = i.household_id
                            WHERE i.id = p_invoice_id);
    $$;
    REVOKE ALL ON FUNCTION list_active_budgets_for_invoice(UUID) FROM PUBLIC;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DROP FUNCTION IF EXISTS list_active_budgets_for_invoice(UUID);`);
}
