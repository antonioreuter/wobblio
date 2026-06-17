import type { PoolClient } from 'pg';
import type {
  IReleasableHeldInvoiceReader,
  ReleasableHeldInvoice,
} from '@core/ports/ingestion/IReleasableHeldInvoiceReader';

interface ReleasableRow {
  invoice_id: string;
  tenant_id: string;
  country_code: string;
  region_code: string;
}

// Reads via the SECURITY DEFINER helper, so it runs cross-tenant before any tenant
// context is set — RLS on invoice does not apply to the function's owner privileges.
export class ReleasableHeldInvoiceReaderAdapter implements IReleasableHeldInvoiceReader {
  constructor(private readonly client: PoolClient) {}

  async listReleasable(limit: number): Promise<ReleasableHeldInvoice[]> {
    const result = await this.client.query<ReleasableRow>(
      'SELECT invoice_id, tenant_id, country_code, region_code FROM list_releasable_held_invoices($1)',
      [limit],
    );
    return result.rows.map(r => ({
      invoiceId: r.invoice_id,
      tenantId: r.tenant_id,
      countryCode: r.country_code,
      regionCode: r.region_code,
    }));
  }
}
