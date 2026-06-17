import type { PoolClient } from 'pg';
import type { IProductSearch, ProductSearchResult } from '@core/ports/data-intelligence/IProductSearch';
import type { BaseUnit } from '@core/domain/unitSize';

interface ProductRow {
  id: string;
  display_name: string;
  brand: string | null;
  category_id: string;
  base_unit: BaseUnit;
  pack_size_base_units: string | null;
}

// product is a global (RLS-exempt) table; the PROVISIONAL branch is scoped to the
// caller via the RLS-visible invoice_line/invoice join, so tenant context must be
// set on this client's transaction before calling.
export class ProductSearchAdapter implements IProductSearch {
  constructor(private readonly client: PoolClient) {}

  async search(query: string, limit: number): Promise<ProductSearchResult[]> {
    const result = await this.client.query<ProductRow>(
      `SELECT p.id, p.display_name, p.brand, p.category_id, p.base_unit,
              p.pack_size_base_units::text AS pack_size_base_units
       FROM product p
       WHERE (p.display_name % $1 OR p.display_name ILIKE '%' || $1 || '%')
         AND (
           p.status = 'ACTIVE'
           OR (
             p.status = 'PROVISIONAL'
             AND p.id IN (
               SELECT l.product_id
               FROM invoice_line l
               JOIN invoice i ON i.id = l.invoice_id
               WHERE l.product_id IS NOT NULL
             )
           )
         )
       ORDER BY similarity(p.display_name, $1) DESC, p.display_name
       LIMIT $2`,
      [query, limit],
    );
    return result.rows.map(row => ({
      productId: row.id,
      displayName: row.display_name,
      brand: row.brand,
      categoryId: row.category_id,
      baseUnit: row.base_unit,
      packSizeBaseUnits: row.pack_size_base_units === null ? null : parseFloat(row.pack_size_base_units),
    }));
  }
}
