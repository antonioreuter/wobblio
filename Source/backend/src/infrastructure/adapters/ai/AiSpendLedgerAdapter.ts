import type { Pool, PoolClient } from 'pg';
import type { IAiSpendLedger, AiSpendRecord } from '@core/ports/ai/IAiSpendLedger';

export class AiSpendLedgerAdapter implements IAiSpendLedger {
  constructor(private readonly pool: Pool | PoolClient) {}

  async record(entry: AiSpendRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO ai_spend_ledger
         (tenant_id, date, model_role, input_tokens, output_tokens, est_cost)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [entry.tenantId, entry.date, entry.modelRole, entry.inputTokens, entry.outputTokens, entry.estCost],
    );
  }

  async getDailyTotal(tenantId: string, date: string): Promise<number> {
    const result = await this.pool.query<{ total: string | null }>(
      `SELECT COALESCE(SUM(est_cost), 0)::text AS total
       FROM ai_spend_ledger
       WHERE tenant_id = $1 AND date = $2`,
      [tenantId, date],
    );
    return parseFloat(result.rows[0]?.total ?? '0');
  }
}
