import pino from 'pino';
import type { Pool, PoolClient } from 'pg';
import type { ProcessingStage } from '@core/domain/processingStage';
import type { IProcessingProgress } from '@core/ports/ingestion/IProcessingProgress';
import { TenantContextAdapter } from '@infrastructure/adapters/identity/TenantContextAdapter';
import { resolveLogLevel } from '@infrastructure/logging/logger';

const logger = pino({ level: resolveLogLevel() }).child({ service: 'processing-progress' });

// Writes the stage flips a client polls while an invoice is PROCESSING.
//
// Takes the POOL, not the pipeline's PoolClient: that client is inside the worker's single long
// transaction, so a stage written on it would only become visible at COMMIT. Each write is its
// own short transaction on a second connection (worker pool is max:2 for exactly this) and is
// held for milliseconds — three writes per invoice.
//
// Never throws (IProcessingProgress contract): a progress failure logs and is dropped, because
// losing a label is trivially preferable to failing an ingestion that otherwise succeeded.
export class ProcessingProgressAdapter implements IProcessingProgress {
  constructor(private readonly pool: Pool) {}

  async recordStage(invoiceId: string, tenantId: string, stage: ProcessingStage): Promise<void> {
    let client: PoolClient | undefined;
    try {
      client = await this.pool.connect();
      await client.query('BEGIN');
      await new TenantContextAdapter(client).setTenantId(tenantId);
      await client.query(
        `INSERT INTO invoice_processing_progress (invoice_id, tenant_id, stage)
         VALUES ($1, $2, $3)
         ON CONFLICT (invoice_id) DO UPDATE SET stage = EXCLUDED.stage, updated_at = now()`,
        [invoiceId, tenantId, stage],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client?.query('ROLLBACK').catch(() => undefined);
      logger.warn({ event: 'processing_progress_failed', invoiceId, stage, err });
    } finally {
      client?.release();
    }
  }
}
