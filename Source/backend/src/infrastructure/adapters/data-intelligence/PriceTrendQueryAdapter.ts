import type { Pool, PoolClient } from 'pg';
import type {
  IPriceTrendQuery,
  PriceTrendLine,
  PriceTrendQueryInput,
  RegionCurrencyQueryInput,
} from '@core/ports/data-intelligence/IPriceTrendQuery';

import type { BaseUnit } from '@core/domain/unitSize';
import { currencyFilter } from './queryFilters';

interface WeeklyRow {
  product_id: string;
  merchant_id: string;
  brand_name: string;
  week_start: string;
  median: string | null;
  discount_median: string | null;
  observation_count: string;
  last_observed_on: string;
  unit: BaseUnit | null;
}

// §6.5.1 comparison over the global, RLS-exempt price_observation store (no tenant
// context). The k≥3 cell gate is the HAVING in `cell`: a (product, merchant) pair
// below the threshold is dropped here and never reaches the service. Weekly medians
// split discounted from regular observations — promo prices are a distinct signal,
// not blended into the median (§6.5.1).
//
// Price unit follows the cell: when every observation shares one known pack size the median
// is the comparable €/unit (normalized_unit_price); otherwise it falls back to €/item
// (pack_price), which is honest within a SKU over time but NOT cross-comparable. The chosen
// unit is surfaced so the UI can gate cross-store comparisons.
export class PriceTrendQueryAdapter implements IPriceTrendQuery {
  constructor(private readonly db: Pool | PoolClient) {}

  async comparison(input: PriceTrendQueryInput): Promise<PriceTrendLine[]> {
    // Currency honesty: filter to the resolved view currency so medians never blend across
    // currencies. Omitted only when the currency couldn't be resolved (no rows to infer one).
    const params: unknown[] = [
      input.productIds, input.countryCode, input.regionCode, input.weeks, input.kMin,
    ];
    const currencyClause = currencyFilter('po.currency', input.currency, params);

    const result = await this.db.query<WeeklyRow>(
      `WITH obs AS (
         SELECT po.product_id, po.merchant_id,
                date_trunc('week', po.observed_on)::date AS week_start,
                po.pack_price,
                po.normalized_unit_price,
                po.base_unit,
                po.was_discounted,
                po.observed_on
         FROM price_observation po
         WHERE po.product_id = ANY($1::uuid[])
           AND po.country_code = $2
           AND po.region_code = $3
           AND po.quarantined = false
           AND po.observed_on >= CURRENT_DATE - ($4::int * 7)
           ${currencyClause}
       ),
       cell AS (
         SELECT product_id, merchant_id,
                COUNT(*) AS observation_count,
                MAX(observed_on) AS last_observed_on,
                -- unit is "known" only when every observation has a per-unit price and they
                -- all share a single base unit; otherwise the cell serves pack price.
                (COUNT(*) FILTER (WHERE normalized_unit_price IS NULL) = 0
                   AND COUNT(DISTINCT base_unit) = 1) AS unit_known,
                MIN(base_unit) AS base_unit
         FROM obs
         GROUP BY product_id, merchant_id
         HAVING COUNT(*) >= $5::int
       ),
       weekly AS (
         SELECT o.product_id, o.merchant_id, o.week_start,
                percentile_cont(0.5) WITHIN GROUP (
                  ORDER BY CASE WHEN c.unit_known THEN o.normalized_unit_price ELSE o.pack_price END)
                  FILTER (WHERE NOT o.was_discounted) AS median,
                percentile_cont(0.5) WITHIN GROUP (
                  ORDER BY CASE WHEN c.unit_known THEN o.normalized_unit_price ELSE o.pack_price END)
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
              c.last_observed_on::text AS last_observed_on,
              CASE WHEN c.unit_known THEN c.base_unit ELSE NULL END AS unit
       FROM weekly w
       JOIN cell c ON c.product_id = w.product_id AND c.merchant_id = w.merchant_id
       JOIN merchant m ON m.id = w.merchant_id
       ORDER BY w.product_id, m.brand_name, w.week_start`,
      params,
    );

    return groupIntoLines(result.rows);
  }

  // Pre-gate merchant count for the cold-start motivator: distinct non-quarantined merchants per
  // selected product in the region/currency/window, taking the max (the product closest to
  // unlocking). Deliberately NOT k-gated so the "N stores tracked" nudge shows before any cell
  // clears k≥3. 0 when nothing is tracked yet.
  async regionMerchantCount(input: PriceTrendQueryInput): Promise<number> {
    const params: unknown[] = [input.productIds, input.countryCode, input.regionCode, input.weeks];
    const currencyClause = currencyFilter('po.currency', input.currency, params);

    const result = await this.db.query<{ max_merchants: string | null }>(
      `SELECT MAX(cnt)::text AS max_merchants
         FROM (
           SELECT po.product_id, COUNT(DISTINCT po.merchant_id) AS cnt
             FROM price_observation po
            WHERE po.product_id = ANY($1::uuid[])
              AND po.country_code = $2
              AND po.region_code = $3
              AND po.quarantined = false
              AND po.observed_on >= CURRENT_DATE - ($4::int * 7)
              ${currencyClause}
            GROUP BY po.product_id
         ) per_product`,
      params,
    );
    return result.rows[0]?.max_merchants ? parseInt(result.rows[0].max_merchants, 10) : 0;
  }

  // Most frequent observation currency in the region for the selected products — the fallback
  // view currency when the picker country isn't in the currency map. null when no rows exist.
  async modalCurrency(input: RegionCurrencyQueryInput): Promise<string | null> {
    const result = await this.db.query<{ currency: string }>(
      `SELECT po.currency
         FROM price_observation po
        WHERE po.product_id = ANY($1::uuid[])
          AND po.country_code = $2
          AND po.region_code = $3
          AND po.quarantined = false
          AND po.observed_on >= CURRENT_DATE - ($4::int * 7)
        GROUP BY po.currency
        ORDER BY COUNT(*) DESC, po.currency ASC
        LIMIT 1`,
      [input.productIds, input.countryCode, input.regionCode, input.weeks],
    );
    return result.rows[0]?.currency ?? null;
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
        unit: row.unit,
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
