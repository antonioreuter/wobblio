import type { Pool, PoolClient } from 'pg';
import type {
  IPersonalInflationQuery,
  PersonalInflationInput,
} from '@core/ports/data-intelligence/IPersonalInflationQuery';
import type { MatchedBasketItem } from '@core/domain/personalInflation';
import { currencyFilter } from './queryFilters';

interface BasketRow {
  product_id: string;
  current_median: string;
  prior_median: string;
}

// Matched-basket median prices for the caller's own purchases, current period vs the one before it.
// The db MUST already carry the tenant context (invoice/invoice_line are RLS-scoped). Price basis
// mirrors OwnPurchaseHistoryQueryAdapter: €/unit when every own line for a product has a per-unit
// price and a single base unit, else €/item (pack price). Deposit/fee and discount lines excluded
// so the two periods compare like-for-like regular shelf price. Only products with a median in BOTH
// periods are returned — that's what makes it matched-basket (measuring price change, not basket
// change). Not integration-tested yet — verify against a seeded tenant before relying on the number.
export class PersonalInflationQueryAdapter implements IPersonalInflationQuery {
  constructor(private readonly db: Pool | PoolClient) {}

  async matchedBasket(input: PersonalInflationInput): Promise<MatchedBasketItem[]> {
    const params: unknown[] = [input.windowDays];
    const currencyClause = currencyFilter('i.currency', input.homeCurrency, params);
    const result = await this.db.query<BasketRow>(
      `WITH lines AS (
         SELECT l.product_id,
                (l.line_total / NULLIF(l.quantity, 0)) AS pack_price,
                l.normalized_unit_price,
                l.base_unit,
                CASE
                  WHEN i.transaction_date >= CURRENT_DATE - $1::int THEN 'current'
                  WHEN i.transaction_date >= CURRENT_DATE - (2 * $1::int) THEN 'prior'
                END AS bucket
         FROM invoice_line l
         JOIN invoice i ON i.id = l.invoice_id
         WHERE i.status IN ('PARSED', 'NEEDS_REVIEW')
           AND i.transaction_date IS NOT NULL
           AND i.transaction_date >= CURRENT_DATE - (2 * $1::int)
           AND l.line_total > 0
           AND l.quantity > 0
           AND l.is_deposit_or_fee = false
           AND l.is_discount = false
           AND l.product_id IS NOT NULL
           ${currencyClause}
       ),
       prod AS (
         -- per-unit only when every line for the product has a per-unit price and one base unit;
         -- otherwise both periods' medians use the pack price (€/item).
         SELECT product_id,
                (COUNT(*) FILTER (WHERE normalized_unit_price IS NULL) = 0
                   AND COUNT(DISTINCT base_unit) = 1) AS unit_known
         FROM lines
         GROUP BY product_id
       ),
       medians AS (
         SELECT l.product_id, l.bucket,
                percentile_cont(0.5) WITHIN GROUP (
                  ORDER BY CASE WHEN p.unit_known THEN l.normalized_unit_price ELSE l.pack_price END
                ) AS med
         FROM lines l
         JOIN prod p ON p.product_id = l.product_id
         WHERE l.bucket IS NOT NULL
         GROUP BY l.product_id, l.bucket
       )
       SELECT c.product_id,
              c.med::text AS current_median,
              pr.med::text AS prior_median
       FROM medians c
       JOIN medians pr ON pr.product_id = c.product_id AND pr.bucket = 'prior'
       WHERE c.bucket = 'current'`,
      params,
    );

    return result.rows.map((row) => ({
      productId: row.product_id,
      currentMedian: parseFloat(row.current_median),
      priorMedian: parseFloat(row.prior_median),
    }));
  }
}
