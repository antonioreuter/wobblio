import type { Pool, PoolClient } from 'pg';
import type { IQuotaRepository, QuotaType } from '@core/ports/quota/IQuotaRepository';

export class QuotaRepositoryAdapter implements IQuotaRepository {
  constructor(private readonly pool: Pool | PoolClient) {}

  async getUsed(tenantId: string, type: QuotaType, weekStart: string): Promise<number> {
    const result = await this.pool.query<{ used: string }>(
      `SELECT COALESCE(used, 0)::text AS used
       FROM quota_counter
       WHERE tenant_id = $1 AND counter = $2 AND week_start = $3`,
      [tenantId, type, weekStart],
    );
    return parseInt(result.rows[0]?.used ?? '0', 10);
  }

  async increment(tenantId: string, type: QuotaType, weekStart: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO quota_counter (tenant_id, counter, week_start, used)
       VALUES ($1, $2, $3, 1)
       ON CONFLICT (tenant_id, counter, week_start)
       DO UPDATE SET used = quota_counter.used + 1`,
      [tenantId, type, weekStart],
    );
  }

  async decrement(tenantId: string, type: QuotaType, weekStart: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO quota_counter (tenant_id, counter, week_start, used)
       VALUES ($1, $2, $3, 0)
       ON CONFLICT (tenant_id, counter, week_start)
       DO UPDATE SET used = GREATEST(0, quota_counter.used - 1)`,
      [tenantId, type, weekStart],
    );
  }
}
