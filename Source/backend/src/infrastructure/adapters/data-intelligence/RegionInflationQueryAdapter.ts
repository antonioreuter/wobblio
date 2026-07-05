import type { Pool, PoolClient } from 'pg';
import type {
  IRegionInflationQuery,
  RegionInflationInput,
} from '@core/ports/data-intelligence/IRegionInflationQuery';
import type { MatchedBasketItem } from '@core/domain/personalInflation';

interface BasketRow {
  product_id: string;
  current_median: string;
  prior_median: string;
}

// §6.8 read-time serving gate: a product's price is only servable in a region once it has this
// many distinct observations. Applied per period so both medians rest on real density.
export const MIN_REGION_OBSERVATIONS = 3;

// Region matched-basket median prices, current period vs the one before it, over the RLS-exempt
// price_observation store. No tenant context is set or needed — these rows are de-identified by
// design (§6.5). Quarantined (unpromoted catalog) and discounted rows are excluded so the index
// tracks promoted, regular shelf price. Only products meeting the k-observation quorum in BOTH
// periods survive. Not integration-tested yet — verify against seeded observations before relying
// on the number.
export class RegionInflationQueryAdapter implements IRegionInflationQuery {
  constructor(private readonly db: Pool | PoolClient) {}

  async matchedBasket(input: RegionInflationInput): Promise<MatchedBasketItem[]> {
    const k = input.minObservations ?? MIN_REGION_OBSERVATIONS;
    const result = await this.db.query<BasketRow>(
      `WITH obs AS (
         SELECT product_id,
                pack_price,
                normalized_unit_price,
                base_unit,
                CASE
                  WHEN observed_on >= CURRENT_DATE - $2::int THEN 'current'
                  WHEN observed_on >= CURRENT_DATE - (2 * $2::int) THEN 'prior'
                END AS bucket
         FROM price_observation
         WHERE region_code = $1
           AND quarantined = false
           AND was_discounted = false
           AND pack_price > 0
           AND observed_on >= CURRENT_DATE - (2 * $2::int)
       ),
       prod AS (
         -- per-unit only when every observation for the product has a per-unit price and one base
         -- unit; otherwise both periods' medians use the pack price (€/item).
         SELECT product_id,
                (COUNT(*) FILTER (WHERE normalized_unit_price IS NULL) = 0
                   AND COUNT(DISTINCT base_unit) = 1) AS unit_known
         FROM obs
         GROUP BY product_id
       ),
       agg AS (
         SELECT o.product_id, o.bucket,
                percentile_cont(0.5) WITHIN GROUP (
                  ORDER BY CASE WHEN p.unit_known THEN o.normalized_unit_price ELSE o.pack_price END
                ) AS med,
                COUNT(*) AS n
         FROM obs o
         JOIN prod p ON p.product_id = o.product_id
         WHERE o.bucket IS NOT NULL
         GROUP BY o.product_id, o.bucket
       )
       SELECT c.product_id,
              c.med::text AS current_median,
              pr.med::text AS prior_median
       FROM agg c
       JOIN agg pr ON pr.product_id = c.product_id AND pr.bucket = 'prior'
       WHERE c.bucket = 'current'
         AND c.n >= $3::int
         AND pr.n >= $3::int`,
      [input.regionCode, input.windowDays, k],
    );

    return result.rows.map((row) => ({
      productId: row.product_id,
      currentMedian: parseFloat(row.current_median),
      priorMedian: parseFloat(row.prior_median),
    }));
  }
}
