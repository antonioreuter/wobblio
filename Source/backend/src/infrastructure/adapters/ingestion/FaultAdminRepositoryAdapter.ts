import type { Pool, PoolClient } from 'pg';
import type {
  IFaultAdminRepository,
  BlockedInvoice,
  ReprocessTarget,
} from '@core/ports/ingestion/IFaultAdminRepository';
import type { FailureReasonCode } from '@core/domain/failureReasons';

interface BlockedRow {
  invoice_id: string;
  owner_id: string;
  system_fault_reason: string;
  image_s3_key: string;
  blocked_at: string;
}

// Calls the §07 SECURITY DEFINER fault functions. They bypass RLS, so this works on the
// admin connection (whose tenant scope is the admin, not the invoice owners).
export class FaultAdminRepositoryAdapter implements IFaultAdminRepository {
  constructor(private readonly client: Pool | PoolClient) {}

  async listBlocked(): Promise<BlockedInvoice[]> {
    const result = await this.client.query<BlockedRow>(
      `SELECT invoice_id, owner_id, system_fault_reason, image_s3_key, blocked_at::text AS blocked_at
       FROM admin_blocked_invoices()`,
    );
    return result.rows.map((row) => ({
      invoiceId: row.invoice_id,
      ownerId: row.owner_id,
      systemFaultReason: row.system_fault_reason,
      imageS3Key: row.image_s3_key,
      blockedAt: row.blocked_at,
    }));
  }

  async reprocess(invoiceId: string): Promise<ReprocessTarget | null> {
    const result = await this.client.query<{ tenant_id: string; s3_key: string }>(
      `SELECT tenant_id, s3_key FROM admin_reprocess_invoice($1)`,
      [invoiceId],
    );
    const row = result.rows[0];
    return row ? { tenantId: row.tenant_id, s3Key: row.s3_key } : null;
  }

  async wontProcess(invoiceId: string, reasonCode: FailureReasonCode): Promise<{ tenantId: string } | null> {
    const result = await this.client.query<{ tenant_id: string }>(
      `SELECT tenant_id FROM admin_wont_process_invoice($1, $2)`,
      [invoiceId, reasonCode],
    );
    const row = result.rows[0];
    return row ? { tenantId: row.tenant_id } : null;
  }
}
