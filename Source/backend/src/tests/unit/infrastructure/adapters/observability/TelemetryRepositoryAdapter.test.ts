import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PoolClient } from 'pg';
import { TelemetryRepositoryAdapter } from '@infrastructure/adapters/observability/TelemetryRepositoryAdapter';

describe('TelemetryRepositoryAdapter', () => {
  let query: ReturnType<typeof vi.fn>;
  let repo: TelemetryRepositoryAdapter;

  beforeEach(() => {
    query = vi.fn().mockResolvedValue({ rowCount: 1 });
    repo = new TelemetryRepositoryAdapter({ query } as unknown as PoolClient);
  });

  it('inserts one invoice_telemetry row with the fields in column order', async () => {
    await repo.recordInvoiceTelemetry({
      tenantId: 'tenant-1',
      invoiceId: 'inv-1',
      processingMs: 4250,
      inputTokens: 1200,
      outputTokens: 400,
      costUsd: 0.0152,
      status: 'PARSED',
    });

    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO invoice_telemetry');
    expect(sql).toContain('tenant_id, invoice_id, processing_ms, input_tokens, output_tokens, cost_usd, status');
    expect(query).toHaveBeenCalledWith(expect.any(String), [
      'tenant-1',
      'inv-1',
      4250,
      1200,
      400,
      0.0152,
      'PARSED',
    ]);
  });
});
