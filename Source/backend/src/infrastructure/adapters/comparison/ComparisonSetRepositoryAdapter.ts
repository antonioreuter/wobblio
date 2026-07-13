import type { Pool, PoolClient } from 'pg';
import type {
  ComparisonSet,
  ComparisonSetMember,
  ComparisonMemberSource,
  IComparisonSetRepository,
} from '@core/ports/comparison/IComparisonSetRepository';
import { catalogSize, type BaseUnit } from '@core/domain/unitSize';

interface Row {
  set_id: string;
  name: string | null;
  created_at: string;
  member_id: string | null;
  product_id: string | null;
  display_name: string | null;
  brand: string | null;
  merchant_id: string | null;
  merchant_name: string | null;
  pack_size_base_units: string | null;
  base_unit: BaseUnit | null;
  source: ComparisonMemberSource | null;
  size_equivalent: boolean | null;
  added_at: string | null;
}

// 09/04 comparison sets over the RLS-enabled product_comparison_set(_member) tables. Tenant context
// MUST already be set (withTenantTx): RLS scopes every read/write to the caller, and inserts stamp
// tenant_id from app.current_tenant_id so no tenant id crosses the port (invariant #1).
export class ComparisonSetRepositoryAdapter implements IComparisonSetRepository {
  constructor(private readonly db: Pool | PoolClient) {}

  async list(): Promise<ComparisonSet[]> {
    const result = await this.db.query<Row>(`${SET_SELECT} ORDER BY s.created_at DESC, m.added_at`);
    return groupIntoSets(result.rows);
  }

  async getById(setId: string): Promise<ComparisonSet | null> {
    const result = await this.db.query<Row>(
      `${SET_SELECT} WHERE s.id = $1 ORDER BY m.added_at`,
      [setId],
    );
    if (result.rows.length === 0) return null;
    return groupIntoSets(result.rows)[0] ?? null;
  }

  async create(name: string | null): Promise<string> {
    const result = await this.db.query<{ id: string }>(
      `INSERT INTO product_comparison_set (tenant_id, name)
       VALUES (current_setting('app.current_tenant_id', true)::uuid, $1)
       RETURNING id`,
      [name],
    );
    return result.rows[0].id;
  }

  async rename(setId: string, name: string | null): Promise<boolean> {
    const result = await this.db.query('UPDATE product_comparison_set SET name = $2 WHERE id = $1', [setId, name]);
    return (result.rowCount ?? 0) > 0;
  }

  async remove(setId: string): Promise<boolean> {
    const result = await this.db.query('DELETE FROM product_comparison_set WHERE id = $1', [setId]);
    return (result.rowCount ?? 0) > 0;
  }

  async memberCount(setId: string): Promise<number> {
    const result = await this.db.query<{ n: string }>(
      'SELECT count(*)::text AS n FROM product_comparison_set_member WHERE set_id = $1',
      [setId],
    );
    return parseInt(result.rows[0].n, 10);
  }

  async exists(setId: string): Promise<boolean> {
    const result = await this.db.query('SELECT 1 FROM product_comparison_set WHERE id = $1', [setId]);
    return (result.rowCount ?? 0) > 0;
  }

  // ON CONFLICT DO NOTHING keeps the UNIQUE(set_id, product_id) idempotent; a NULL id signals the
  // product was already a member (or RLS hid the set), which the service maps to a 400.
  async addMember(setId: string, productId: string, sizeEquivalent: boolean): Promise<string | null> {
    const result = await this.db.query<{ id: string }>(
      `INSERT INTO product_comparison_set_member (set_id, tenant_id, product_id, source, size_equivalent)
       VALUES ($1, current_setting('app.current_tenant_id', true)::uuid, $2, 'USER', $3)
       ON CONFLICT (set_id, product_id) DO NOTHING
       RETURNING id`,
      [setId, productId, sizeEquivalent],
    );
    return result.rows[0]?.id ?? null;
  }

  async removeMember(setId: string, memberId: string): Promise<boolean> {
    const result = await this.db.query(
      'DELETE FROM product_comparison_set_member WHERE set_id = $1 AND id = $2',
      [setId, memberId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async setSizeEquivalent(setId: string, memberId: string, sizeEquivalent: boolean): Promise<boolean> {
    const result = await this.db.query(
      'UPDATE product_comparison_set_member SET size_equivalent = $3 WHERE set_id = $1 AND id = $2',
      [setId, memberId, sizeEquivalent],
    );
    return (result.rowCount ?? 0) > 0;
  }
}

const SET_SELECT = `
  SELECT s.id AS set_id, s.name, s.created_at::text AS created_at,
         m.id AS member_id, m.product_id, m.source, m.size_equivalent, m.added_at::text AS added_at,
         p.display_name, p.brand, p.merchant_id,
         p.pack_size_base_units::text AS pack_size_base_units, p.base_unit,
         mer.brand_name AS merchant_name
  FROM product_comparison_set s
  LEFT JOIN product_comparison_set_member m ON m.set_id = s.id
  LEFT JOIN product p ON p.id = m.product_id
  LEFT JOIN merchant mer ON mer.id = p.merchant_id`;

function groupIntoSets(rows: Row[]): ComparisonSet[] {
  const sets = new Map<string, ComparisonSet>();
  for (const row of rows) {
    let set = sets.get(row.set_id);
    if (!set) {
      set = { id: row.set_id, name: row.name, createdAt: row.created_at, members: [] };
      sets.set(row.set_id, set);
    }
    if (row.member_id !== null) set.members.push(toMember(row));
  }
  return [...sets.values()];
}

function toMember(row: Row): ComparisonSetMember {
  const packSize = row.pack_size_base_units === null ? null : parseFloat(row.pack_size_base_units);
  return {
    id: row.member_id as string,
    productId: row.product_id as string,
    displayName: row.display_name ?? '',
    brand: row.brand,
    merchantId: row.merchant_id,
    merchantName: row.merchant_name,
    source: row.source as ComparisonMemberSource,
    sizeEquivalent: row.size_equivalent ?? false,
    size: catalogSize(packSize, row.base_unit),
    addedAt: row.added_at as string,
  };
}
