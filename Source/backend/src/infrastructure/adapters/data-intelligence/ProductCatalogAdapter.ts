import type { Pool, PoolClient } from 'pg';
import type { IProductCatalog, ProductMatch, CreateProvisionalProductInput, WriteProductAliasInput } from '@core/ports/data-intelligence/IProductCatalog';
import type { BaseUnit } from '@core/domain/unitSize';

interface ProductRow {
  id: string;
  category_id: string;
  base_unit: BaseUnit;
  pack_size_base_units: string | null;
  sim: string;
}

const toMatch = (row: ProductRow): ProductMatch => ({
  productId: row.id,
  categoryId: row.category_id,
  baseUnit: row.base_unit,
  packSizeBaseUnits: row.pack_size_base_units === null ? null : parseFloat(row.pack_size_base_units),
  similarity: parseFloat(row.sim),
});

const toVectorLiteral = (embedding: number[]): string => `[${embedding.join(',')}]`;

// §6.3 product catalog over the global product/product_alias tables (no RLS).
export class ProductCatalogAdapter implements IProductCatalog {
  constructor(private readonly db: Pool | PoolClient) {}

  async findExactAlias(merchantId: string | null, normalized: string): Promise<ProductMatch | null> {
    const result = await this.db.query<ProductRow>(
      `SELECT p.id, p.category_id, p.base_unit, p.pack_size_base_units::text AS pack_size_base_units, '1'::text AS sim
       FROM product_alias a JOIN product p ON p.id = a.product_id
       WHERE a.alias_normalized = $1 AND (a.merchant_id = $2 OR a.merchant_id IS NULL)
       ORDER BY a.merchant_id NULLS LAST
       LIMIT 1`,
      [normalized, merchantId],
    );
    return result.rows[0] ? toMatch(result.rows[0]) : null;
  }

  async searchByEmbedding(embedding: number[], categoryId: string | null, limit: number): Promise<ProductMatch[]> {
    const result = await this.db.query<ProductRow>(
      `SELECT p.id, p.category_id, p.base_unit, p.pack_size_base_units::text AS pack_size_base_units,
              (1 - (p.embedding <=> $1::vector))::text AS sim
       FROM product p
       WHERE p.status <> 'INACTIVE' AND p.embedding IS NOT NULL
         AND ($2::text IS NULL OR p.category_id = $2)
       ORDER BY p.embedding <=> $1::vector
       LIMIT $3`,
      [toVectorLiteral(embedding), categoryId, limit],
    );
    return result.rows.map(toMatch);
  }

  async createProvisionalProduct(input: CreateProvisionalProductInput): Promise<string> {
    const result = await this.db.query<{ id: string }>(
      `INSERT INTO product (category_id, display_name, base_unit, pack_size_base_units, embedding, created_via, status)
       VALUES ($1, $2, $3, $4, $5::vector, 'AUTO', 'PROVISIONAL')
       RETURNING id`,
      [input.categoryId, input.displayName, input.baseUnit, input.packSizeBaseUnits, toVectorLiteral(input.embedding)],
    );
    return result.rows[0].id;
  }

  async writeAlias(input: WriteProductAliasInput): Promise<void> {
    await this.db.query(
      `INSERT INTO product_alias (product_id, alias_normalized, merchant_id, match_count, source, last_seen_at)
       SELECT $1, $2, $3, 1, $4, now()
       WHERE NOT EXISTS (
         SELECT 1 FROM product_alias
         WHERE product_id = $1 AND alias_normalized = $2 AND merchant_id IS NOT DISTINCT FROM $3
       )`,
      [input.productId, input.aliasNormalized, input.merchantId, input.source],
    );
  }
}
