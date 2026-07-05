import type { PoolClient } from 'pg';
import type {
  IBillSplitShareRepository,
  CreateBillSplitShareInput,
  ResolvedBillSplitShare,
} from '@core/ports/splitting/IBillSplitShareRepository';

export class BillSplitShareRepositoryAdapter implements IBillSplitShareRepository {
  constructor(private readonly client: PoolClient) {}

  async create(input: CreateBillSplitShareInput): Promise<string> {
    const result = await this.client.query<{ id: string }>(
      `INSERT INTO bill_split_share
         (split_id, created_by_user_id, token_hash, token_enc, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [input.splitId, input.createdByUserId, input.tokenHash, input.tokenEnc, input.expiresAt],
    );
    return result.rows[0].id;
  }

  async resolve(tokenHash: string): Promise<ResolvedBillSplitShare | null> {
    const result = await this.client.query<{ split_id: string; tenant_id: string }>(
      `SELECT split_id, tenant_id FROM resolve_bill_split_share($1)`,
      [tokenHash],
    );
    const row = result.rows[0];
    if (!row) return null;
    return { splitId: row.split_id, tenantId: row.tenant_id };
  }
}
