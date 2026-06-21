import type { Pool, PoolClient } from 'pg';
import type {
  IPriceTrendQuery,
  PriceTrendLine,
  PriceTrendQueryInput,
} from '@core/ports/data-intelligence/IPriceTrendQuery';

interface WeeklyRow {
  product_id: string;
  merchant_id: string;
  brand_name: string;
  week_start: string;
  median: string | null;
  discount_median: string | null;
  observation_count: string;
  last_observed_on: string;
}

// §6.5.1 comparison over the global, RLS-exempt price_observation store (no tenant
// context). The k≥3 cell gate is the HAVING in `cell`: a (product, merchant) pair
// below the threshold is dropped here and never reaches the service. Weekly medians
// split discounted from regular observations — promo prices are a distinct signal,
// not blended into the median (§6.5.1).
export class PriceTrendQueryAdapter implements IPriceTrendQuery {
  constructor(private readonly db: Pool | PoolClient) {}

  async comparison(input: PriceTrendQueryInput): Promise<PriceTrendLine[]> {
    const result = await this.db.query<WeeklyRow>(
      `WITH obs AS (
         SELECT po.product_id, po.merchant_id,
                date_trunc('week', po.observed_on)::date AS week_start,
                po.normalized_unit_price AS price,
                po.was_discounted,
                po.observed_on
         FROM price_observation po
         WHERE po.product_id = ANY($1::uuid[])
           AND po.country_code = $2
           AND po.region_code = $3
           AND po.quarantined = false
           AND po.observed_on >= CURRENT_DATE - ($4::int * 7)
       ),
       cell AS (
         SELECT product_id, merchant_id,
                COUNT(*) AS observation_count,
                MAX(observed_on) AS last_observed_on
         FROM obs
         GROUP BY product_id, merchant_id
         HAVING COUNT(*) >= $5::int
       ),
       weekly AS (
         SELECT o.product_id, o.merchant_id, o.week_start,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY o.price)
                  FILTER (WHERE NOT o.was_discounted) AS median,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY o.price)
                  FILTER (WHERE o.was_discounted) AS discount_median
         FROM obs o
         JOIN cell c ON c.product_id = o.product_id AND c.merchant_id = o.merchant_id
         GROUP BY o.product_id, o.merchant_id, o.week_start
       )
       SELECT w.product_id, w.merchant_id, m.brand_name,
              w.week_start::text AS week_start,
              w.median::text AS median,
              w.discount_median::text AS discount_median,
              c.observation_count::text AS observation_count,
              c.last_observed_on::text AS last_observed_on
       FROM weekly w
       JOIN cell c ON c.product_id = w.product_id AND c.merchant_id = w.merchant_id
       JOIN merchant m ON m.id = w.merchant_id
       ORDER BY w.product_id, m.brand_name, w.week_start`,
      [input.productIds, input.countryCode, input.regionCode, input.weeks, input.kMin],
    );

    return groupIntoLines(result.rows);
  }
}

// Rows arrive ordered by (product, merchant, week), so each cell's points are already
// chronological — accumulate them into one line per (product, merchant) pair.
function groupIntoLines(rows: WeeklyRow[]): PriceTrendLine[] {
  const lines = new Map<string, PriceTrendLine>();
  for (const row of rows) {
    const key = `${row.product_id}|${row.merchant_id}`;
    let line = lines.get(key);
    if (!line) {
      line = {
        productId: row.product_id,
        merchantId: row.merchant_id,
        merchantName: row.brand_name,
        points: [],
        observationCount: parseInt(row.observation_count, 10),
        lastObservedOn: row.last_observed_on,
      };
      lines.set(key, line);
    }
    line.points.push({
      weekStart: row.week_start,
      median: row.median === null ? null : parseFloat(row.median),
      discountMedian: row.discount_median === null ? null : parseFloat(row.discount_median),
    });
  }
  return [...lines.values()];
}
