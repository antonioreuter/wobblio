import type { PoolClient } from 'pg';
import type { IIngestionLedger } from '@core/ports/ingestion/IIngestionLedger';

export class IngestionLedgerAdapter implements IIngestionLedger {
  constructor(private readonly client: PoolClient) {}

  async claim(s3Key: string, tenantId: string): Promise<boolean> {
    const result = await this.client.query(
      `INSERT INTO ingestion_ledger (s3_key, tenant_id, status)
       VALUES ($1, $2, 'PROCESSING')
       ON CONFLICT (s3_key) DO NOTHING`,
      [s3Key, tenantId],
    );
    return result.rowCount === 1;
  }

  async setStatus(s3Key: string, status: string): Promise<void> {
    await this.client.query(
      `UPDATE ingestion_ledger SET status = $2 WHERE s3_key = $1`,
      [s3Key, status],
    );
  }

  async release(s3Key: string): Promise<void> {
    await this.client.query(`DELETE FROM ingestion_ledger WHERE s3_key = $1`, [s3Key]);
  }
}
