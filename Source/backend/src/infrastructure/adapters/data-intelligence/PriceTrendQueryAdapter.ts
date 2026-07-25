import type { Pool, PoolClient } from 'pg';
import type {
  IPriceTrendQuery,
  PriceTrendLine,
  PriceTrendQueryInput,
  ProductObservationStats,
  RegionCurrencyQueryInput,
} from '@core/ports/data-intelligence/IPriceTrendQuery';

import { catalogSize, type BaseUnit } from '@core/domain/unitSize';
import { detectAmbiguity } from '@core/domain/priceAmbiguity';
import type { IAmbiguityConfig } from '@core/ports/data-intelligence/IAmbiguityConfig';
import { currencyFilter } from './queryFilters';

// Fallback price-ambiguity gap (09/05) only when no ambiguity config is injected (e.g. integration
// tests). Production passes the SAME SsmAmbiguityConfigAdapter the optimizer uses, so the trend
// banner and the crown/optimizer never disagree on what "ambiguous" means.
const DEFAULT_AMBIGUITY_GAP = 0.4;

interface WeeklyRow {
  product_id: string;
  merchant_id: string;
  brand_name: string;
  week_start: string;
  median: string | null;
  discount_median: string | null;
  observation_count: string;
  last_observed_on: string;
  pack_size_base_units: string | null;
  base_unit: BaseUnit | null;
  reg_prices: number[] | null;
}

// §6.5.1 comparison over the global, RLS-exempt price_observation store (no tenant
// context). The k≥3 cell gate is the HAVING in `cell`: a (product, merchant) pair
// below the threshold is dropped here and never reaches the service. Weekly medians
// split discounted from regular observations — promo prices are a distinct signal,
// not blended into the median (§6.5.1).
//
// Every median is the pack price paid (pack_price = line_total ÷ quantity) — receipt-verbatim,
// the sole price signal (fix 09/01). No per-unit price is ever computed. Each series also
// carries its product's descriptive pack size (a chip like "2L"), sourced from the product
// catalog, never used as a price basis.
export class PriceTrendQueryAdapter implements IPriceTrendQuery {
  constructor(
    private readonly db: Pool | PoolClient,
    private readonly ambiguityConfig?: IAmbiguityConfig,
  ) {}

  // The ambiguity gap comes from the same SSM-backed config as the optimizer (single source of
  // truth); only when none is injected do we fall back to the documented default.
  private async ambiguityGap(): Promise<number> {
    return this.ambiguityConfig ? (await this.ambiguityConfig.get()).gapPct : DEFAULT_AMBIGUITY_GAP;
  }

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
                -- Non-discounted prices for read-time ambiguity detection (09/05); promos excluded.
                array_agg(pack_price::float8) FILTER (WHERE NOT was_discounted) AS reg_prices
         FROM obs
         GROUP BY product_id, merchant_id
         HAVING COUNT(*) >= $5::int
       ),
       weekly AS (
         SELECT o.product_id, o.merchant_id, o.week_start,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY o.pack_price)
                  FILTER (WHERE NOT o.was_discounted) AS median,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY o.pack_price)
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
              p.pack_size_base_units::text AS pack_size_base_units,
              p.base_unit AS base_unit,
              c.reg_prices AS reg_prices
       FROM weekly w
       JOIN cell c ON c.product_id = w.product_id AND c.merchant_id = w.merchant_id
       JOIN merchant m ON m.id = w.merchant_id
       JOIN product p ON p.id = w.product_id
       ORDER BY w.product_id, m.brand_name, w.week_start`,
      params,
    );

    return groupIntoLines(result.rows, await this.ambiguityGap());
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

  // Per-product region stats for the fix-10 empty-chart diagnostics. One grouped scan splits each
  // (product, merchant) cell's counts by window+currency, then rolls up per product: the in-window
  // view-currency total, the in-window OTHER-currency total, the largest single-merchant cell (how
  // close to k≥3), and how many merchants have any in-window+currency row. Only products with at
  // least one non-quarantined region row appear — an absent product has no region data at all.
  async productDiagnostics(input: PriceTrendQueryInput): Promise<ProductObservationStats[]> {
    const params: unknown[] = [input.productIds, input.countryCode, input.regionCode, input.weeks, input.currency];
    const result = await this.db.query<{
      product_id: string;
      in_window_currency_count: string;
      other_currency_in_window_count: string;
      max_cell_count: string;
      merchant_count: string;
    }>(
      `WITH per_cell AS (
         SELECT po.product_id, po.merchant_id,
                COUNT(*) FILTER (
                  WHERE po.observed_on >= CURRENT_DATE - ($4::int * 7)
                    AND ($5::text IS NULL OR po.currency = $5)
                ) AS in_window_currency_cnt,
                COUNT(*) FILTER (
                  WHERE po.observed_on >= CURRENT_DATE - ($4::int * 7)
                    AND $5::text IS NOT NULL AND po.currency <> $5
                ) AS other_currency_in_window_cnt
         FROM price_observation po
         WHERE po.product_id = ANY($1::uuid[])
           AND po.country_code = $2
           AND po.region_code = $3
           AND po.quarantined = false
         GROUP BY po.product_id, po.merchant_id
       )
       SELECT product_id,
              COALESCE(SUM(in_window_currency_cnt), 0)::text AS in_window_currency_count,
              COALESCE(SUM(other_currency_in_window_cnt), 0)::text AS other_currency_in_window_count,
              COALESCE(MAX(in_window_currency_cnt), 0)::text AS max_cell_count,
              COUNT(*) FILTER (WHERE in_window_currency_cnt > 0)::text AS merchant_count
       FROM per_cell
       GROUP BY product_id`,
      params,
    );
    return result.rows.map((row) => ({
      productId: row.product_id,
      inWindowCurrencyCount: parseInt(row.in_window_currency_count, 10),
      otherCurrencyInWindowCount: parseInt(row.other_currency_in_window_count, 10),
      maxCellCount: parseInt(row.max_cell_count, 10),
      merchantCount: parseInt(row.merchant_count, 10),
    }));
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
function groupIntoLines(rows: WeeklyRow[], ambiguityGapPct: number): PriceTrendLine[] {
  const lines = new Map<string, PriceTrendLine>();
  for (const row of rows) {
    const key = `${row.product_id}|${row.merchant_id}`;
    let line = lines.get(key);
    if (!line) {
      const packSize = row.pack_size_base_units === null ? null : parseFloat(row.pack_size_base_units);
      line = {
        productId: row.product_id,
        merchantId: row.merchant_id,
        merchantName: row.brand_name,
        points: [],
        observationCount: parseInt(row.observation_count, 10),
        lastObservedOn: row.last_observed_on,
        size: catalogSize(packSize, row.base_unit),
        ambiguous: detectAmbiguity(row.reg_prices ?? [], { gapPct: ambiguityGapPct }).ambiguous,
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
