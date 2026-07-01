import type { PoolClient } from 'pg';
import type {
  IBillSplitRepository,
  BillSplitMeta,
  StoredAssignment,
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

  async listAssignments(splitId: string): Promise<StoredAssignment[]> {
    const result = await this.client.query<{ line_id: string; participant_name_enc: string; fraction: string }>(
      `SELECT line_id, participant_name_enc, fraction::text AS fraction
       FROM bill_split_line WHERE split_id = $1`,
      [splitId],
    );
    return result.rows.map((r) => ({
      lineId: r.line_id,
      participantNameEnc: r.participant_name_enc,
      fraction: parseFloat(r.fraction),
    }));
  }

  async upsertAssignment(
    splitId: string,
    lineId: string,
    participantNameEnc: string,
    fraction: number,
  ): Promise<void> {
    await this.client.query(
      `INSERT INTO bill_split_line (split_id, line_id, participant_name_enc, fraction)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (split_id, line_id)
       DO UPDATE SET participant_name_enc = EXCLUDED.participant_name_enc, fraction = EXCLUDED.fraction`,
      [splitId, lineId, participantNameEnc, fraction],
    );
  }

  async removeAssignment(splitId: string, lineId: string): Promise<void> {
    await this.client.query(
      `DELETE FROM bill_split_line WHERE split_id = $1 AND line_id = $2`,
      [splitId, lineId],
    );
  }
}
