import type { PoolClient } from 'pg';
import type {
  IBillSplitRepository,
  BillSplitMeta,
  StoredAllocation,
  LineAllocationInput,
} from '@core/ports/splitting/IBillSplitRepository';

// RLS on bill_split / bill_split_line scopes every row to the caller's invoices (tenant_isolation
// policies keyed through invoice.tenant_id), so no explicit tenant filtering is needed here.
export class BillSplitRepositoryAdapter implements IBillSplitRepository {
  constructor(private readonly client: PoolClient) {}

  async create(invoiceId: string): Promise<string> {
    const result = await this.client.query<{ id: string }>(
      `INSERT INTO bill_split (invoice_id) VALUES ($1) RETURNING id`,
      [invoiceId],
    );
    return result.rows[0].id;
  }

  async getMeta(splitId: string): Promise<BillSplitMeta | null> {
    const result = await this.client.query<{ id: string; invoice_id: string }>(
      `SELECT id, invoice_id FROM bill_split WHERE id = $1`,
      [splitId],
    );
    const row = result.rows[0];
    return row ? { id: row.id, invoiceId: row.invoice_id } : null;
  }

  async listAllocations(splitId: string): Promise<StoredAllocation[]> {
    const result = await this.client.query<{ line_id: string; participant_name_enc: string; units: string }>(
      `SELECT line_id, participant_name_enc, units::text AS units
       FROM bill_split_line WHERE split_id = $1`,
      [splitId],
    );
    return result.rows.map((r) => ({
      lineId: r.line_id,
      participantNameEnc: r.participant_name_enc,
      units: parseFloat(r.units),
    }));
  }

  // A line's allocation set is replaced wholesale so multi-participant edits stay atomic.
  // The caller already runs inside a tenant transaction (withTenantTx).
  async setLineAllocations(splitId: string, lineId: string, allocations: LineAllocationInput[]): Promise<void> {
    await this.client.query(
      `DELETE FROM bill_split_line WHERE split_id = $1 AND line_id = $2`,
      [splitId, lineId],
    );
    for (const a of allocations) {
      await this.client.query(
        `INSERT INTO bill_split_line (split_id, line_id, participant_name_enc, units)
         VALUES ($1, $2, $3, $4)`,
        [splitId, lineId, a.participantNameEnc, a.units],
      );
    }
  }
}
