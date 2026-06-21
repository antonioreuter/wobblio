import type { Pool, PoolClient } from 'pg';
import type {
  IOwnPurchaseHistoryQuery,
  OwnPurchaseLine,
  OwnPurchaseQueryInput,
} from '@core/ports/data-intelligence/IOwnPurchaseHistoryQuery';

interface WeeklyRow {
  product_id: string;
  week_start: string;
  median: string | null;
  discount_median: string | null;
  purchase_count: string;
  last_purchased_on: string;
}

// The caller's OWN purchase history over the RLS-scoped invoice_line store — the db
// MUST already carry the tenant context (see withTenantTx). No k≥3 gate: own data is
// served regardless of public quorum, which is the whole point. Region is matched to the
// selected picker via invoice.location_* (the same region the public store would emit to);
// deposit/fee lines and lines without a normalized unit price are excluded. Weekly medians
// split discounted from regular purchases, mirroring the public trend.
export class OwnPurchaseHistoryQueryAdapter implements IOwnPurchaseHistoryQuery {
  constructor(private readonly db: Pool | PoolClient) {}

  async history(input: OwnPurchaseQueryInput): Promise<OwnPurchaseLine[]> {
    const result = await this.db.query<WeeklyRow>(
      `WITH lines AS (
         SELECT l.product_id,
                date_trunc('week', i.transaction_date)::date AS week_start,
                l.normalized_unit_price AS price,
                l.is_discount,
                i.transaction_date
         FROM invoice_line l
         JOIN invoice i ON i.id = l.invoice_id
         WHERE l.product_id = ANY($1::uuid[])
           AND i.status IN ('PARSED', 'NEEDS_REVIEW')
           AND i.transaction_date IS NOT NULL
           AND i.transaction_date >= CURRENT_DATE - ($2::int * 7)
           AND l.normalized_unit_price IS NOT NULL
           AND l.is_deposit_or_fee = false
           AND i.location_country_code = $3
           AND i.location_region_code = $4
       ),
       weekly AS (
         SELECT product_id, week_start,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY price)
                  FILTER (WHERE NOT is_discount) AS median,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY price)
                  FILTER (WHERE is_discount) AS discount_median
         FROM lines
         GROUP BY product_id, week_start
       ),
       totals AS (
         SELECT product_id,
                COUNT(*) AS purchase_count,
                MAX(transaction_date) AS last_purchased_on
         FROM lines
         GROUP BY product_id
       )
       SELECT w.product_id,
              w.week_start::text AS week_start,
              w.median::text AS median,
              w.discount_median::text AS discount_median,
              t.purchase_count::text AS purchase_count,
              t.last_purchased_on::text AS last_purchased_on
       FROM weekly w
       JOIN totals t ON t.product_id = w.product_id
       ORDER BY w.product_id, w.week_start`,
      [input.productIds, input.weeks, input.countryCode, input.regionCode],
    );

    return groupIntoLines(result.rows);
  }
}

// Rows arrive ordered by (product, week), so each product's points are chronological —
// accumulate them into one line per product.
function groupIntoLines(rows: WeeklyRow[]): OwnPurchaseLine[] {
  const lines = new Map<string, OwnPurchaseLine>();
  for (const row of rows) {
    let line = lines.get(row.product_id);
    if (!line) {
      line = {
        productId: row.product_id,
        points: [],
        purchaseCount: parseInt(row.purchase_count, 10),
        lastPurchasedOn: row.last_purchased_on,
      };
      lines.set(row.product_id, line);
    }
    line.points.push({
      weekStart: row.week_start,
      median: row.median === null ? null : parseFloat(row.median),
      discountMedian: row.discount_median === null ? null : parseFloat(row.discount_median),
    });
  }
  return [...lines.values()];
}
