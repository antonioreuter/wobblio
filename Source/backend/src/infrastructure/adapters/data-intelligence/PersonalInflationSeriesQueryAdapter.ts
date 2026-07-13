import type { Pool, PoolClient } from 'pg';
import type {
  IPersonalInflationSeriesQuery,
  PersonalSeriesInput,
} from '@core/ports/data-intelligence/IInflationSeriesQuery';
import type { MonthlyProductMedian } from '@core/domain/inflationSeries';
import { currencyFilter } from './queryFilters';

interface MedianRow {
  period: string;
  product_id: string;
  median: string;
}

// Per-month, per-product median prices from the caller's OWN invoices (RLS-scoped — tenant context
// MUST be set first). Same price basis and line filters as PersonalInflationQueryAdapter (regular,
// non-discount, non-deposit lines; pack price paid — the sole signal, never per-unit, fix 09/01),
// grouped by the invoice month instead of a current/prior bucket. The domain baselines these.
export class PersonalInflationSeriesQueryAdapter implements IPersonalInflationSeriesQuery {
  constructor(private readonly db: Pool | PoolClient) {}

  async monthlyMedians(input: PersonalSeriesInput): Promise<MonthlyProductMedian[]> {
    const params: unknown[] = [input.months];
    const currencyClause = currencyFilter('i.currency', input.homeCurrency, params);
    const result = await this.db.query<MedianRow>(
      `WITH lines AS (
         SELECT to_char(i.transaction_date, 'YYYY-MM') AS period,
                l.product_id,
                (l.line_total / NULLIF(l.quantity, 0)) AS pack_price
         FROM invoice_line l
         JOIN invoice i ON i.id = l.invoice_id
         WHERE i.status IN ('PARSED', 'NEEDS_REVIEW')
           AND i.transaction_date IS NOT NULL
           AND i.transaction_date >= (date_trunc('month', CURRENT_DATE)
                 - (($1::int - 1) * INTERVAL '1 month'))
           AND l.line_total > 0
           AND l.quantity > 0
           AND l.is_deposit_or_fee = false
           AND l.is_discount = false
           AND l.product_id IS NOT NULL
           ${currencyClause}
       )
       SELECT l.period,
              l.product_id,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY l.pack_price)::text AS median
       FROM lines l
       GROUP BY l.period, l.product_id`,
      params,
    );
    return result.rows.map((row) => ({
      period: row.period,
      productId: row.product_id,
      median: parseFloat(row.median),
    }));
  }
}
