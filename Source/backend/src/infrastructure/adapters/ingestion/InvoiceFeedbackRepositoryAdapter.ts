import type { PoolClient } from 'pg';
import type { IInvoiceFeedbackRepository } from '@core/ports/ingestion/IInvoiceFeedbackRepository';
import type { InvoiceVerdict } from '@core/domain/ingestion';

// Relies on RLS (app.current_tenant_id) set on this client's transaction; tenant_id
// is sourced from the same setting so the row always passes the tenant_isolation policy.
export class InvoiceFeedbackRepositoryAdapter implements IInvoiceFeedbackRepository {
  constructor(private readonly client: PoolClient) {}

  async upsert(invoiceId: string, verdict: InvoiceVerdict): Promise<void> {
    await this.client.query(
      `INSERT INTO invoice_feedback (invoice_id, tenant_id, verdict)
       VALUES ($1, current_setting('app.current_tenant_id', true)::uuid, $2::invoice_verdict)
       ON CONFLICT (invoice_id, tenant_id)
       DO UPDATE SET verdict = EXCLUDED.verdict, created_at = now()`,
      [invoiceId, verdict],
    );
  }

  async getVerdict(invoiceId: string): Promise<InvoiceVerdict | null> {
    const result = await this.client.query<{ verdict: InvoiceVerdict }>(
      `SELECT verdict FROM invoice_feedback WHERE invoice_id = $1`,
      [invoiceId],
    );
    return result.rows[0]?.verdict ?? null;
  }
}
