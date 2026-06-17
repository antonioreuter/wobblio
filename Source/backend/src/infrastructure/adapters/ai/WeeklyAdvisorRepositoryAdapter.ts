import type { Pool, PoolClient } from 'pg';
import type {
  IWeeklyAdvisorRepository,
  AdvisorTenant,
  AdvisorFactsData,
  AdvisorCard,
} from '@core/ports/ai/IWeeklyAdvisorRepository';
import type { BudgetFact, PriceFinding } from '@core/domain/weeklyAdvisor';

const SCOPE_LABEL: Record<string, string> = {
  TOTAL: 'Total spending',
  CATEGORY: 'Category',
  MEMBER: 'Member',
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Cron methods (listEligibleTenants/gatherFacts/save) use SECURITY DEFINER
// functions and need no tenant context; getCurrent is RLS-scoped to the caller.
export class WeeklyAdvisorRepositoryAdapter implements IWeeklyAdvisorRepository {
  constructor(private readonly pool: Pool | PoolClient) {}

  async listEligibleTenants(weekStart: string): Promise<AdvisorTenant[]> {
    const result = await this.pool.query<{ tenant_id: string; language: string; currency: string }>(
      `SELECT tenant_id, language, currency FROM list_advisor_eligible_tenants($1)`,
      [weekStart],
    );
    return result.rows.map(row => ({
      tenantId: row.tenant_id,
      language: row.language,
      currency: row.currency,
    }));
  }

  async gatherFacts(tenantId: string, weekStart: string): Promise<AdvisorFactsData> {
    const spendThisWeek = await this.spend(tenantId, weekStart, addDays(weekStart, 7));
    const spendLastWeek = await this.spend(tenantId, addDays(weekStart, -7), weekStart);
    const budgets = await this.budgets(tenantId);
    const priceFindings = await this.priceFindings(tenantId, 3);
    return { spendThisWeek, spendLastWeek, budgets, priceFindings, splitRoute: null };
  }

  async save(tenantId: string, weekStart: string, body: string): Promise<void> {
    await this.pool.query(`SELECT save_weekly_advisor($1, $2, $3)`, [tenantId, weekStart, body]);
  }

  async getCurrent(): Promise<AdvisorCard | null> {
    const result = await this.pool.query<{ week_start: string; body: string; generated_at: string }>(
      `SELECT week_start::text AS week_start, body, generated_at::text AS generated_at
       FROM weekly_advisor LIMIT 1`,
    );
    const row = result.rows[0];
    return row ? { weekStart: row.week_start, body: row.body, generatedAt: row.generated_at } : null;
  }

  private async spend(tenantId: string, from: string, to: string): Promise<number> {
    const result = await this.pool.query<{ spend: string }>(
      `SELECT compute_budget_spend($1, 'TOTAL', NULL, NULL, $2, $3)::text AS spend`,
      [tenantId, from, to],
    );
    return parseFloat(result.rows[0].spend);
  }

  private async budgets(tenantId: string): Promise<BudgetFact[]> {
    const result = await this.pool.query<{ scope: string; amount: string; accumulated: string }>(
      `SELECT scope, amount::text AS amount, accumulated::text AS accumulated FROM advisor_budgets($1)`,
      [tenantId],
    );
    return result.rows.map(row => {
      const amount = parseFloat(row.amount);
      return { label: SCOPE_LABEL[row.scope] ?? row.scope, amount, remaining: round2(amount - parseFloat(row.accumulated)) };
    });
  }

  private async priceFindings(tenantId: string, limit: number): Promise<PriceFinding[]> {
    const result = await this.pool.query<{
      product_name: string; your_price: string; cheapest_price: string;
      merchant_name: string; observation_count: number;
    }>(
      `SELECT product_name, your_price::text AS your_price, cheapest_price::text AS cheapest_price,
              merchant_name, observation_count
       FROM advisor_price_findings($1, $2)`,
      [tenantId, limit],
    );
    return result.rows.map(row => ({
      product: row.product_name,
      yourPrice: parseFloat(row.your_price),
      cheapestPrice: parseFloat(row.cheapest_price),
      merchant: row.merchant_name,
      observationCount: row.observation_count,
    }));
  }
}
