import type { Pool, PoolClient } from 'pg';
import type {
  CloneVariantInput,
  IProductSplitRepository,
  ParentProductInfo,
} from '@core/ports/data-intelligence/IProductSplitRepository';
import type { BaseUnit } from '@core/domain/unitSize';
import { normalizeProductText } from '@core/domain/textNormalize';

// 09/05 product-split resolution over the global product/product_alias tables (no RLS) plus the
// caller's RLS-scoped invoice_line rows (tenant context MUST be set via withTenantTx).
export class ProductSplitRepositoryAdapter implements IProductSplitRepository {
  constructor(private readonly db: Pool | PoolClient) {}

  async getParent(productId: string): Promise<ParentProductInfo | null> {
    const result = await this.db.query<{ merchant_id: string | null; display_name: string; category_id: string; base_unit: BaseUnit; country_code: string }>(
      `SELECT merchant_id, display_name, category_id, base_unit, country_code FROM product WHERE id = $1`,
      [productId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      merchantId: row.merchant_id,
      displayName: row.display_name,
      categoryId: row.category_id,
      baseUnit: row.base_unit,
      countryCode: row.country_code,
    };
  }

  async cloneVariant(input: CloneVariantInput): Promise<string> {
    // Copy the parent's embedding so the variant still participates in matching; stamp the same
    // merchant (per-merchant identity) and the user-annotated size.
    const result = await this.db.query<{ id: string }>(
      `INSERT INTO product (category_id, country_code, merchant_id, display_name, brand, base_unit, pack_size_base_units, embedding, created_via, status)
       SELECT $2, $3, $4, $5, brand, $6, $7, embedding, 'AUTO', 'PROVISIONAL'
       FROM product WHERE id = $1
       RETURNING id`,
      [input.parentProductId, input.categoryId, input.countryCode, input.merchantId, input.displayName, input.baseUnit, input.size?.packQuantity ?? null],
    );
    return result.rows[0].id;
  }

  async moveOwnLines(
    parentProductId: string,
    newProductId: string,
    lineIds: string[],
    size: { packQuantity: number; baseUnit: BaseUnit } | null,
  ): Promise<string[]> {
    if (lineIds.length === 0) return [];
    // RLS scopes invoice_line to the caller; only lines still pointing at the parent are moved, so a
    // stale id (already re-homed) is a safe no-op. Size, when given, is stamped USER.
    const result = await this.db.query<{ raw_text: string }>(
      `UPDATE invoice_line
         SET product_id = $2,
             pack_quantity = COALESCE($4, pack_quantity),
             base_unit = COALESCE($5, base_unit),
             size_source = CASE WHEN $4 IS NOT NULL THEN 'USER'::size_source ELSE size_source END
       WHERE id = ANY($3::uuid[]) AND product_id = $1
       RETURNING raw_text`,
      [parentProductId, newProductId, lineIds, size?.packQuantity ?? null, size?.baseUnit ?? null],
    );
    return [...new Set(result.rows.map((r) => r.raw_text))];
  }

  async writeConfirmedAliases(newProductId: string, merchantId: string, rawTexts: string[]): Promise<void> {
    for (const raw of rawTexts) {
      // Same normalization as resolution (ProductNormalizer) so future receipts match this alias.
      const normalized = normalizeProductText(raw);
      if (!normalized) continue;
      // Repoint an existing merchant-scoped alias to the corrected variant, or create one — so
      // future receipts at this merchant resolve to the new SKU (exact-alias match, §6.3 step 1).
      const updated = await this.db.query(
        `UPDATE product_alias SET product_id = $1, source = 'USER_CONFIRMED'
         WHERE alias_normalized = $2 AND merchant_id IS NOT DISTINCT FROM $3`,
        [newProductId, normalized, merchantId],
      );
      if ((updated.rowCount ?? 0) === 0) {
        await this.db.query(
          `INSERT INTO product_alias (product_id, alias_normalized, merchant_id, source)
           VALUES ($1, $2, $3, 'USER_CONFIRMED')`,
          [newProductId, normalized, merchantId],
        );
      }
    }
  }
}

