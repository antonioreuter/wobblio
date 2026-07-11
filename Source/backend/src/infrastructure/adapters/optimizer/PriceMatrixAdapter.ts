import type { PoolClient } from 'pg';
import type { IPriceMatrix } from '@core/ports/optimizer/IPriceMatrix';
import type { PriceMatrix, PriceCell, MerchantRef } from '@core/domain/routeOptimizer';

interface CellRow {
  product_id: string;
  merchant_id: string;
  merchant_name: string;
  price: string;
  observation_count: number;
  last_observed_on: string;
}

interface AvgRow {
  product_id: string;
  avg_price: string;
}

// price_observation is the global, RLS-exempt store; userAverages comes from the
// caller's RLS-scoped invoice lines, so set tenant context before calling.
export class PriceMatrixAdapter implements IPriceMatrix {
  constructor(private readonly client: PoolClient) {}

  async build(
    productIds: string[],
    regionCode: string,
    countryCode: string,
    currency: string,
  ): Promise<PriceMatrix> {
    if (productIds.length === 0) return { merchants: [], cells: [], userAverages: {} };

    const cellRows = await this.client.query<CellRow>(
      `SELECT po.product_id, po.merchant_id, m.brand_name AS merchant_name,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY po.pack_price)::text AS price,
              count(*)::int AS observation_count,
              max(po.observed_on)::text AS last_observed_on
       FROM price_observation po
       JOIN merchant m ON m.id = po.merchant_id
       WHERE po.region_code = $1 AND po.country_code = $3 AND po.currency = $4
         AND po.product_id = ANY($2::uuid[]) AND po.quarantined = false
       GROUP BY po.product_id, po.merchant_id, m.brand_name
       HAVING count(*) >= 3`,
      [regionCode, productIds, countryCode, currency],
    );

    const avgRows = await this.client.query<AvgRow>(
      `SELECT l.product_id, avg(l.line_total / NULLIF(l.quantity, 0))::text AS avg_price
       FROM invoice_line l
       JOIN invoice i ON i.id = l.invoice_id
       WHERE l.product_id = ANY($1::uuid[]) AND i.status IN ('PARSED', 'NEEDS_REVIEW')
         AND i.currency = $2
       GROUP BY l.product_id`,
      [productIds, currency],
    );

    return {
      merchants: toMerchants(cellRows.rows),
      cells: cellRows.rows.map(toCell),
      userAverages: toAverages(avgRows.rows),
    };
  }
}

function toCell(row: CellRow): PriceCell {
  return {
    productId: row.product_id,
    merchantId: row.merchant_id,
    price: parseFloat(row.price),
    observationCount: row.observation_count,
    lastObservedOn: row.last_observed_on,
  };
}

function toMerchants(rows: CellRow[]): MerchantRef[] {
  const byId = new Map<string, MerchantRef>();
  for (const row of rows) byId.set(row.merchant_id, { id: row.merchant_id, name: row.merchant_name });
  return [...byId.values()];
}

function toAverages(rows: AvgRow[]): Record<string, number> {
  const averages: Record<string, number> = {};
  for (const row of rows) {
    if (row.avg_price !== null) averages[row.product_id] = parseFloat(row.avg_price);
  }
  return averages;
}
