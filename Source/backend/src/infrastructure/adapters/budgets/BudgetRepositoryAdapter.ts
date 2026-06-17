import type { PoolClient } from 'pg';
import type {
  IBudgetRepository,
  CreateBudgetInput,
  BudgetPatch,
  BudgetView,
} from '@core/ports/budgets/IBudgetRepository';
import type { BudgetScope, BudgetPeriod } from '@core/domain/budget';

interface BudgetRow {
  id: string;
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
}

const COLUMNS = `
  id, scope, category_id, member_user_id, amount::text AS amount, period,
  accumulated::text AS accumulated, alert_85_fired, alert_100_fired,
  alert_85_at::text AS alert_85_at, alert_100_at::text AS alert_100_at,
  cycle_start::text AS cycle_start`;

const toView = (row: BudgetRow): BudgetView => ({
  id: row.id,
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
});

// RLS-scoped to app.current_tenant_id set on this client's transaction.
export class BudgetRepositoryAdapter implements IBudgetRepository {
  constructor(private readonly client: PoolClient) {}

  async create(input: CreateBudgetInput): Promise<string> {
    const result = await this.client.query<{ id: string }>(
      `INSERT INTO budget (tenant_id, scope, category_id, member_user_id, amount, period)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [input.tenantId, input.scope, input.categoryId, input.memberUserId, input.amount, input.period],
    );
    return result.rows[0].id;
  }

  async countForTenant(): Promise<number> {
    const result = await this.client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM budget`,
    );
    return parseInt(result.rows[0].count, 10);
  }

  async listForTenant(): Promise<BudgetView[]> {
    const result = await this.client.query<BudgetRow>(
      `SELECT ${COLUMNS} FROM budget ORDER BY cycle_start DESC, id`,
    );
    return result.rows.map(toView);
  }

  async get(budgetId: string): Promise<BudgetView | null> {
    const result = await this.client.query<BudgetRow>(
      `SELECT ${COLUMNS} FROM budget WHERE id = $1`,
      [budgetId],
    );
    return result.rows[0] ? toView(result.rows[0]) : null;
  }

  async update(budgetId: string, patch: BudgetPatch): Promise<boolean> {
    const result = await this.client.query(
      `UPDATE budget
          SET amount = COALESCE($2::numeric, amount),
              period = COALESCE($3::budget_period, period)
        WHERE id = $1`,
      [budgetId, patch.amount ?? null, patch.period ?? null],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async remove(budgetId: string): Promise<boolean> {
    const result = await this.client.query(`DELETE FROM budget WHERE id = $1`, [budgetId]);
    return (result.rowCount ?? 0) > 0;
  }
}
