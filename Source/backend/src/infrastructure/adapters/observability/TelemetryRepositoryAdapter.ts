import type { Pool, PoolClient } from 'pg';
import type {
  ITelemetryRepository,
  InvoiceTelemetryRecord,
} from '@core/ports/observability/ITelemetryRepository';

export class TelemetryRepositoryAdapter implements ITelemetryRepository {
  constructor(private readonly client: Pool | PoolClient) {}

  async recordInvoiceTelemetry(record: InvoiceTelemetryRecord): Promise<void> {
    await this.client.query(
      `INSERT INTO invoice_telemetry
         (tenant_id, invoice_id, pipeline_type, processing_ms, input_tokens, output_tokens, cost_usd, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        record.tenantId,
        record.invoiceId,
        record.pipelineType,
        record.processingMs,
        record.inputTokens,
        record.outputTokens,
        record.costUsd,
        record.status,
      ],
    );
  }
}
