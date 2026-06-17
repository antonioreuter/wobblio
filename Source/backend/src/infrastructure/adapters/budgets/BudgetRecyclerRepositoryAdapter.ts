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

// Cron-side adapter: cross-tenant reads/writes go through SECURITY DEFINER
// functions, so no RLS tenant context is required (and none is set).
export class BudgetRecyclerRepositoryAdapter implements IBudgetRecyclerRepository {
  constructor(private readonly pool: Pool | PoolClient) {}

  async listAllActive(): Promise<ActiveBudget[]> {
    const result = await this.pool.query<ActiveBudgetRow>(
      `SELECT id, tenant_id, scope, category_id, member_user_id,
              amount::text AS amount, period, accumulated::text AS accumulated,
              alert_85_fired, alert_100_fired,
              alert_85_at::text AS alert_85_at, alert_100_at::text AS alert_100_at,
              cycle_start::text AS cycle_start, language, currency
       FROM list_active_budgets()`,
    );
    return result.rows.map(row => ({
      id: row.id,
      tenantId: row.tenant_id,
      scope: row.scope,
      categoryId: row.category_id,
      memberUserId: row.member_user_id,
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
    }));
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
