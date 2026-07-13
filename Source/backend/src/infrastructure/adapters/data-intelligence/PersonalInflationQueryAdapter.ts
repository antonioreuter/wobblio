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
// is the pack price paid (line_total ÷ quantity) — the sole price signal (fix 09/01), never
// per-unit. Deposit/fee and discount lines excluded
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
       medians AS (
         -- Both periods' medians are the pack price paid (fix 09/01) — no per-unit price.
         SELECT l.product_id, l.bucket,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY l.pack_price) AS med
         FROM lines l
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
