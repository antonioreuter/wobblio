import type { PoolClient } from 'pg';
import type {
  IInvoiceShareRepository,
  CreateShareInput,
  ResolvedShare,
} from '@core/ports/ingestion/IInvoiceShareRepository';

export class InvoiceShareRepositoryAdapter implements IInvoiceShareRepository {
  constructor(private readonly client: PoolClient) {}

  async create(input: CreateShareInput): Promise<string> {
    const result = await this.client.query<{ id: string }>(
      `INSERT INTO invoice_share
         (invoice_id, created_by_user_id, token_hash, token_enc, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [input.invoiceId, input.createdByUserId, input.tokenHash, input.tokenEnc, input.expiresAt],
    );
    return result.rows[0].id;
  }

  async resolve(tokenHash: string): Promise<ResolvedShare | null> {
    const result = await this.client.query<{ invoice_id: string; tenant_id: string }>(
      `SELECT invoice_id, tenant_id FROM resolve_invoice_share($1)`,
      [tokenHash],
    );
    const row = result.rows[0];
    if (!row) return null;
    return { invoiceId: row.invoice_id, tenantId: row.tenant_id };
  }
}
