import type { Pool, PoolClient } from 'pg';
import type {
  AcceptedProductLink,
  IProductLinkRepository,
  ProductLinkStatus,
} from '@core/ports/comparison/IProductLinkRepository';

// Fix 10 — product_link mutations over the RLS-enabled table. Tenant context MUST already be set
// (withTenantTx): RLS scopes every write to the caller, and inserts stamp tenant_id from
// app.current_tenant_id so no tenant id crosses the port (invariant #1). The service passes the
// pair already canonical (a < b), satisfying the CHECK constraint.
export class ProductLinkRepositoryAdapter implements IProductLinkRepository {
  constructor(private readonly db: Pool | PoolClient) {}

  async acceptedLinksAmong(productIds: string[]): Promise<AcceptedProductLink[]> {
    if (productIds.length === 0) return [];
    const result = await this.db.query<{ product_a_id: string; product_b_id: string; size_equivalent: boolean }>(
      `SELECT product_a_id, product_b_id, size_equivalent
       FROM product_link
       WHERE status = 'ACCEPTED'
         AND product_a_id = ANY($1::uuid[])
         AND product_b_id = ANY($1::uuid[])`,
      [productIds],
    );
    return result.rows.map((r) => ({
      productAId: r.product_a_id,
      productBId: r.product_b_id,
      sizeEquivalent: r.size_equivalent,
    }));
  }

  async upsert(productAId: string, productBId: string, status: ProductLinkStatus): Promise<void> {
    await this.db.query(
      `INSERT INTO product_link (tenant_id, product_a_id, product_b_id, status, source)
       VALUES (current_setting('app.current_tenant_id', true)::uuid, $1, $2, $3, 'USER_TAP')
       ON CONFLICT (tenant_id, product_a_id, product_b_id)
       DO UPDATE SET status = EXCLUDED.status, updated_at = now()`,
      [productAId, productBId, status],
    );
  }

  async setSizeEquivalent(productAId: string, productBId: string, sizeEquivalent: boolean): Promise<boolean> {
    // Only an ACCEPTED (plotted) pair can be size-confirmed; a DISMISSED or absent pair matches no
    // row, so the service rejects it rather than silently reporting success.
    const result = await this.db.query(
      `UPDATE product_link SET size_equivalent = $3, updated_at = now()
       WHERE product_a_id = $1 AND product_b_id = $2 AND status = 'ACCEPTED'`,
      [productAId, productBId, sizeEquivalent],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
