import type { Pool, PoolClient } from 'pg';
import type {
  ISwitchingSavingsQuery,
  SwitchingSavingsInput,
} from '@core/ports/data-intelligence/ISwitchingSavingsQuery';
import type { SavingsLine } from '@core/domain/switchingSavings';
import { MIN_REGION_OBSERVATIONS } from './RegionInflationQueryAdapter';

interface SavingsRow {
  paid: string;
  region_median: string;
  quantity: string;
}

// Pairs each of the caller's own regular purchase lines in the window with the region's median pack
// price for that product (promoted, non-discounted observations meeting the §6.8 quorum). Tenant
// context MUST be set: the caller's lines are RLS-scoped; the regional median side is not. The domain
// sums the below-median gaps.
export class SwitchingSavingsQueryAdapter implements ISwitchingSavingsQuery {
  constructor(private readonly db: Pool | PoolClient) {}

  async savingsLines(input: SwitchingSavingsInput): Promise<SavingsLine[]> {
    const k = input.minObservations ?? MIN_REGION_OBSERVATIONS;
    // Bind the currency once and reference it on both sides so the join never compares a EUR paid
    // price to a BRL regional median. Null currency (unresolved) leaves both clauses empty. Like
    // currencyFilter (see queryFilters.ts), this is a strict `=` that excludes NULL-currency rows —
    // a price comparison deliberately drops what it can't trust to be the view currency, unlike the
    // spend-total gates which count NULL as home-currency face value.
    const params: unknown[] = [input.regionCode, input.windowDays, k, input.countryCode];
    let regionalCurrency = '';
    let mineCurrency = '';
    if (input.currency !== null) {
      params.push(input.currency);
      regionalCurrency = `AND currency = $${params.length}`;
      mineCurrency = `AND i.currency = $${params.length}`;
    }
    const result = await this.db.query<SavingsRow>(
      `WITH regional AS (
         SELECT product_id,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY pack_price) AS region_median
         FROM price_observation
         WHERE region_code = $1
           AND country_code = $4
           ${regionalCurrency}
           AND quarantined = false
           AND was_discounted = false
           AND pack_price > 0
           AND observed_on >= CURRENT_DATE - $2::int
         GROUP BY product_id
         HAVING COUNT(*) >= $3::int
       ),
       mine AS (
         SELECT l.product_id,
                (l.line_total / NULLIF(l.quantity, 0)) AS paid_pack_price,
                l.quantity
         FROM invoice_line l
         JOIN invoice i ON i.id = l.invoice_id
         WHERE i.status IN ('PARSED', 'NEEDS_REVIEW')
           AND i.transaction_date IS NOT NULL
           AND i.transaction_date >= CURRENT_DATE - $2::int
           AND l.line_total > 0
           AND l.quantity > 0
           AND l.is_deposit_or_fee = false
           AND l.is_discount = false
           AND l.product_id IS NOT NULL
           ${mineCurrency}
       )
       SELECT m.paid_pack_price::text AS paid,
              r.region_median::text AS region_median,
              m.quantity::text AS quantity
       FROM mine m
       JOIN regional r ON r.product_id = m.product_id`,
      params,
    );
    return result.rows.map((row) => ({
      paidUnitPrice: parseFloat(row.paid),
      regionMedian: parseFloat(row.region_median),
      quantity: parseFloat(row.quantity),
    }));
  }
}
