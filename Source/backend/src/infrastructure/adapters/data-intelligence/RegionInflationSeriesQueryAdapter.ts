import type { Pool, PoolClient } from 'pg';
import type {
  IRegionInflationSeriesQuery,
  RegionSeriesInput,
} from '@core/ports/data-intelligence/IInflationSeriesQuery';
import type { MonthlyProductMedian } from '@core/domain/inflationSeries';
import { MIN_REGION_OBSERVATIONS } from './RegionInflationQueryAdapter';
import { currencyFilter } from './queryFilters';

interface MedianRow {
  period: string;
  product_id: string;
  median: string;
}

// Per-month, per-product regional median prices from the RLS-exempt price_observation store (no
// tenant context). Mirrors RegionInflationQueryAdapter's filters (region, promoted, non-discounted)
// but buckets by observation month and keeps only (month, product) cells that clear the §6.8 serving
// quorum, so each plotted point rests on real density.
export class RegionInflationSeriesQueryAdapter implements IRegionInflationSeriesQuery {
  constructor(private readonly db: Pool | PoolClient) {}

  async monthlyMedians(input: RegionSeriesInput): Promise<MonthlyProductMedian[]> {
    const k = input.minObservations ?? MIN_REGION_OBSERVATIONS;
    const params: unknown[] = [input.regionCode, input.months, k, input.countryCode];
    const currencyClause = currencyFilter('currency', input.currency, params);
    const result = await this.db.query<MedianRow>(
      `WITH obs AS (
         SELECT to_char(observed_on, 'YYYY-MM') AS period,
                product_id,
                pack_price
         FROM price_observation
         WHERE region_code = $1
           AND country_code = $4
           ${currencyClause}
           AND quarantined = false
           AND was_discounted = false
           AND pack_price > 0
           AND observed_on >= (date_trunc('month', CURRENT_DATE)
                 - (($2::int - 1) * INTERVAL '1 month'))
       )
       SELECT o.period,
              o.product_id,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY o.pack_price)::text AS median
       FROM obs o
       GROUP BY o.period, o.product_id
       HAVING COUNT(*) >= $3::int`,
      params,
    );
    return result.rows.map((row) => ({
      period: row.period,
      productId: row.product_id,
      median: parseFloat(row.median),
    }));
  }
}
