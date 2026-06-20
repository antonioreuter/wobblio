import type { Pool, PoolClient } from 'pg';
import type {
  IBudgetRecyclerRepository,
  ActiveBudget,
  ComputeSpendInput,
  BudgetState,
} from '@core/ports/budgets/IBudgetRecyclerRepository';
import type { BudgetScope, BudgetPeriod } from '@core/domain/budget';

interface ActiveBudgetRow {
  id: string;
  tenant_id: string;
  scope: BudgetScope;
  category_id: string | null;
  member_user_id: string | null;
  target_label: string | null;
  amount: string;
  period: BudgetPeriod;
  accumulated: string;
  alert_85_fired: boolean;
  alert_100_fired: boolean;
  alert_85_at: string | null;
  alert_100_at: string | null;
  cycle_start: string;
  language: string;
  currency: string;
}

const ACTIVE_BUDGET_COLUMNS = `
  id, tenant_id, scope, category_id, member_user_id, target_label,
  amount::text AS amount, period, accumulated::text AS accumulated,
  alert_85_fired, alert_100_fired,
  alert_85_at::text AS alert_85_at, alert_100_at::text AS alert_100_at,
  cycle_start::text AS cycle_start, language, currency`;

// Localized name of a budget's target — category (CATEGORY/HOUSEHOLD) or member
// (MEMBER). Reused by the per-tenant query and the SECURITY DEFINER functions.
const TARGET_LABEL_SQL = `
  CASE b.scope
    WHEN 'CATEGORY'  THEN (SELECT CASE WHEN u.language = 'nl' THEN COALESCE(pc.name_nl, pc.name) ELSE pc.name END
                             FROM product_category pc WHERE pc.id = b.category_id)
    WHEN 'HOUSEHOLD' THEN (SELECT CASE WHEN u.language = 'nl' THEN COALESCE(pc.name_nl, pc.name) ELSE pc.name END
                             FROM product_category pc WHERE pc.id = b.category_id)
    WHEN 'MEMBER'    THEN (SELECT COALESCE(NULLIF(mu.full_name, ''), mu.email)
                             FROM app_user mu WHERE mu.id = b.member_user_id)
    ELSE NULL
  END`;

const toActiveBudget = (row: ActiveBudgetRow): ActiveBudget => ({
  id: row.id,
  tenantId: row.tenant_id,
  scope: row.scope,
  categoryId: row.category_id,
  memberUserId: row.member_user_id,
  targetLabel: row.target_label,
  amount: parseFloat(row.amount),
  period: row.period,
  accumulated: parseFloat(row.accumulated),
  alert85Fired: row.alert_85_fired,
  alert100Fired: row.alert_100_fired,
  alert85At: row.alert_85_at,
  alert100At: row.alert_100_at,
  cycleStart: row.cycle_start,
  language: row.language,
  currency: row.currency,
});

// Cron-side adapter: cross-tenant reads/writes go through SECURITY DEFINER
// functions, so no RLS tenant context is required (and none is set).
export class BudgetRecyclerRepositoryAdapter implements IBudgetRecyclerRepository {
  constructor(private readonly pool: Pool | PoolClient) {}

  async listAllActive(): Promise<ActiveBudget[]> {
    const result = await this.pool.query<ActiveBudgetRow>(
      `SELECT ${ACTIVE_BUDGET_COLUMNS} FROM list_active_budgets()`,
    );
    return result.rows.map(toActiveBudget);
  }

  async listActiveForInvoice(invoiceId: string): Promise<ActiveBudget[]> {
    const result = await this.pool.query<ActiveBudgetRow>(
      `SELECT ${ACTIVE_BUDGET_COLUMNS} FROM list_active_budgets_for_invoice($1)`,
      [invoiceId],
    );
    return result.rows.map(toActiveBudget);
  }

  // One tenant's active budgets, joined to the owner for locale/currency. Scoped by
  // the explicit tenant filter so it is correct with or without an RLS context.
  async listActiveForTenant(tenantId: string): Promise<ActiveBudget[]> {
    const result = await this.pool.query<ActiveBudgetRow>(
      `SELECT b.id, b.tenant_id, b.scope, b.category_id, b.member_user_id,
              ${TARGET_LABEL_SQL} AS target_label,
              b.amount::text AS amount, b.period, b.accumulated::text AS accumulated,
              b.alert_85_fired, b.alert_100_fired,
              b.alert_85_at::text AS alert_85_at, b.alert_100_at::text AS alert_100_at,
              b.cycle_start::text AS cycle_start, u.language, u.home_currency AS currency
       FROM budget b JOIN app_user u ON u.id = b.tenant_id
       WHERE b.tenant_id = $1`,
      [tenantId],
    );
    return result.rows.map(toActiveBudget);
  }

  async computeSpend(input: ComputeSpendInput): Promise<number> {
    const result = await this.pool.query<{ spend: string }>(
      `SELECT compute_budget_spend($1, $2, $3, $4, $5, $6)::text AS spend`,
      [input.tenantId, input.scope, input.categoryId, input.memberUserId, input.from, input.to],
    );
    return parseFloat(result.rows[0].spend);
  }

  async saveState(budgetId: string, state: BudgetState): Promise<void> {
    await this.pool.query(
      `SELECT save_budget_state($1, $2, $3, $4, $5, $6, $7)`,
      [
        budgetId,
        state.accumulated,
        state.alert85Fired,
        state.alert85At,
        state.alert100Fired,
        state.alert100At,
        state.cycleStart,
      ],
    );
  }
}
