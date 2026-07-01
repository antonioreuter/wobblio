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
  own_merchant_count: string;
  own_merchant_name: string | null;
  market_merchant_count: string;
  market_merchant_name: string | null;
}

// product is a global (RLS-exempt) table; the PROVISIONAL branch is scoped to the
// caller via the RLS-visible invoice_line/invoice join, so tenant context must be
// set on this client's transaction before calling.
export class ProductSearchAdapter implements IProductSearch {
  constructor(private readonly client: PoolClient) {}

  async search(
    query: string,
    limit: number,
    countryCode: string,
    regionCode: string,
    categoryIds?: string[],
  ): Promise<ProductSearchResult[]> {
    const result = await this.client.query<ProductRow>(
      `SELECT p.id, p.display_name, p.brand, p.category_id, p.base_unit,
              p.pack_size_base_units::text AS pack_size_base_units,
              own.merchant_count AS own_merchant_count,
              CASE WHEN own.merchant_count = 1 THEN own.brand_name END AS own_merchant_name,
              mkt.merchant_count AS market_merchant_count,
              CASE WHEN mkt.merchant_count = 1 THEN mkt.brand_name END AS market_merchant_name
       FROM product p
       -- Own: RLS-scoped to the caller via invoice_line/invoice (tenant context already set).
       LEFT JOIN LATERAL (
         SELECT count(DISTINCT i.merchant_id) AS merchant_count,
                max(m.brand_name) AS brand_name
         FROM invoice_line l
         JOIN invoice i ON i.id = l.invoice_id
         JOIN merchant m ON m.id = i.merchant_id
         WHERE l.product_id = p.id
       ) own ON true
       -- Market: RLS-exempt observations, quarantined excluded, scoped to the served region
       -- ('' = global) so the badge matches the region-filtered trends chart. Uses the
       -- (product_id, merchant_id, region_code, observed_on) serving index.
       LEFT JOIN LATERAL (
         SELECT count(DISTINCT po.merchant_id) AS merchant_count,
                max(m.brand_name) AS brand_name
         FROM price_observation po
         JOIN merchant m ON m.id = po.merchant_id
         WHERE po.product_id = p.id AND po.quarantined = false
           AND ($3 = '' OR po.country_code = $3)
           AND ($4 = '' OR po.region_code = $4)
       ) mkt ON true
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
         AND ($5::text[] IS NULL OR p.category_id = ANY($5))
       ORDER BY similarity(p.display_name, $1) DESC, p.display_name
       LIMIT $2`,
      [query, limit, countryCode, regionCode, categoryIds ?? null],
    );
    return result.rows.map(row => ({
      productId: row.id,
      displayName: row.display_name,
      brand: row.brand,
      categoryId: row.category_id,
      baseUnit: row.base_unit,
      packSizeBaseUnits: row.pack_size_base_units === null ? null : parseFloat(row.pack_size_base_units),
      ownMerchantCount: parseInt(row.own_merchant_count, 10) || 0,
      ownMerchantName: row.own_merchant_name,
      marketMerchantCount: parseInt(row.market_merchant_count, 10) || 0,
      marketMerchantName: row.market_merchant_name,
    }));
  }
}
