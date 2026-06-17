import type { PoolClient } from 'pg';
import type {
  IShoppingListRepository,
  ListSummary,
  ListDetail,
  ListItem,
  ItemPatch,
} from '@core/ports/lists/IShoppingListRepository';

interface SummaryRow {
  id: string;
  name: string;
  item_count: number;
  created_at: string;
}

interface ItemRow {
  id: string;
  free_text: string;
  product_id: string | null;
  checked: boolean;
  position: number;
  updated_at: string;
}

const toItem = (row: ItemRow): ListItem => ({
  id: row.id,
  freeText: row.free_text,
  productId: row.product_id,
  checked: row.checked,
  position: row.position,
  updatedAt: row.updated_at,
});

// RLS-scoped to app.current_tenant_id set on this client's transaction.
export class ShoppingListRepositoryAdapter implements IShoppingListRepository {
  constructor(private readonly client: PoolClient) {}

  async countActive(): Promise<number> {
    const result = await this.client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM shopping_list WHERE is_active = true`,
    );
    return parseInt(result.rows[0].count, 10);
  }

  async create(tenantId: string, name: string): Promise<string> {
    const result = await this.client.query<{ id: string }>(
      `INSERT INTO shopping_list (tenant_id, name) VALUES ($1, $2) RETURNING id`,
      [tenantId, name],
    );
    return result.rows[0].id;
  }

  async listActive(): Promise<ListSummary[]> {
    const result = await this.client.query<SummaryRow>(
      `SELECT l.id, l.name, l.created_at::text AS created_at,
              count(i.id)::int AS item_count
       FROM shopping_list l
       LEFT JOIN shopping_list_item i ON i.list_id = l.id
       WHERE l.is_active = true
       GROUP BY l.id
       ORDER BY l.created_at DESC`,
    );
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      itemCount: row.item_count,
      createdAt: row.created_at,
    }));
  }

  async getDetail(listId: string): Promise<ListDetail | null> {
    const head = await this.client.query<{ id: string; name: string; is_active: boolean; created_at: string; completed_at: string | null }>(
      `SELECT id, name, is_active, created_at::text AS created_at, completed_at::text AS completed_at
       FROM shopping_list WHERE id = $1`,
      [listId],
    );
    if (!head.rows[0]) return null;

    const items = await this.client.query<ItemRow>(
      `SELECT id, free_text, product_id, checked, position, updated_at::text AS updated_at
       FROM shopping_list_item WHERE list_id = $1 ORDER BY position, id`,
      [listId],
    );

    return {
      id: head.rows[0].id,
      name: head.rows[0].name,
      isActive: head.rows[0].is_active,
      createdAt: head.rows[0].created_at,
      completedAt: head.rows[0].completed_at,
      items: items.rows.map(toItem),
    };
  }

  async addItem(listId: string, freeText: string, productId: string | null): Promise<string | null> {
    const exists = await this.client.query(
      `SELECT 1 FROM shopping_list WHERE id = $1 AND is_active = true`,
      [listId],
    );
    if (!exists.rowCount) return null;

    const result = await this.client.query<{ id: string }>(
      `INSERT INTO shopping_list_item (list_id, free_text, product_id, position)
       VALUES ($1, $2, $3, (SELECT COALESCE(MAX(position) + 1, 0) FROM shopping_list_item WHERE list_id = $1))
       RETURNING id`,
      [listId, freeText, productId],
    );
    return result.rows[0].id;
  }

  async updateItem(listId: string, itemId: string, patch: ItemPatch): Promise<boolean> {
    const sets: string[] = ['updated_at = now()'];
    const params: unknown[] = [itemId, listId];
    if (patch.checked !== undefined) { sets.push(`checked = $${params.push(patch.checked)}`); }
    if (patch.freeText !== undefined) { sets.push(`free_text = $${params.push(patch.freeText)}`); }
    if (patch.productId !== undefined) { sets.push(`product_id = $${params.push(patch.productId)}`); }

    const result = await this.client.query(
      `UPDATE shopping_list_item SET ${sets.join(', ')} WHERE id = $1 AND list_id = $2`,
      params,
    );
    return (result.rowCount ?? 0) > 0;
  }

  async removeItem(listId: string, itemId: string): Promise<boolean> {
    const result = await this.client.query(
      `DELETE FROM shopping_list_item WHERE id = $1 AND list_id = $2`,
      [itemId, listId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async complete(listId: string): Promise<boolean> {
    const result = await this.client.query(
      `UPDATE shopping_list SET is_active = false, completed_at = now()
       WHERE id = $1 AND is_active = true`,
      [listId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
