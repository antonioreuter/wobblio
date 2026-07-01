import type { PoolClient } from 'pg';
import type {
  IShoppingListShareRepository,
  CreateListShareInput,
  ResolvedListShare,
} from '@core/ports/lists/IShoppingListShareRepository';

export class ShoppingListShareRepositoryAdapter implements IShoppingListShareRepository {
  constructor(private readonly client: PoolClient) {}

  async create(input: CreateListShareInput): Promise<string> {
    const result = await this.client.query<{ id: string }>(
      `INSERT INTO shopping_list_share
         (list_id, created_by_user_id, token_hash, token_enc, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [input.listId, input.createdByUserId, input.tokenHash, input.tokenEnc, input.expiresAt],
    );
    return result.rows[0].id;
  }

  async resolve(tokenHash: string): Promise<ResolvedListShare | null> {
    const result = await this.client.query<{ list_id: string; tenant_id: string }>(
      `SELECT list_id, tenant_id FROM resolve_shopping_list_share($1)`,
      [tokenHash],
    );
    const row = result.rows[0];
    if (!row) return null;
    return { listId: row.list_id, tenantId: row.tenant_id };
  }

  async revoke(listId: string, shareId: string): Promise<boolean> {
    const result = await this.client.query(
      `UPDATE shopping_list_share SET revoked_at = now()
       WHERE id = $1 AND list_id = $2 AND revoked_at IS NULL`,
      [shareId, listId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
