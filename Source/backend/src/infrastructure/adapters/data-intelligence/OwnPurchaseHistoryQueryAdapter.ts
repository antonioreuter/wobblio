import type { Pool, PoolClient } from 'pg';
import type {
  IOwnPurchaseHistoryQuery,
  OwnPurchaseLine,
  OwnPurchaseQueryInput,
} from '@core/ports/data-intelligence/IOwnPurchaseHistoryQuery';

import type { BaseUnit } from '@core/domain/unitSize';

interface WeeklyRow {
  product_id: string;
  week_start: string;
  median: string | null;
  discount_median: string | null;
  purchase_count: string;
  last_purchased_on: string;
  unit: BaseUnit | null;
}

// The caller's OWN purchase history over the RLS-scoped invoice_line store — the db
// MUST already carry the tenant context (see withTenantTx). No k≥3 gate: own data is
// served regardless of public quorum, which is the whole point. Location match: a
// RESOLVED receipt must match the picker country+region (same as the public store would
// emit to); a receipt still pending location review (location_status <> 'RESOLVED', region
// NULL) is also served when its country is unknown or matches the picker — full access to
// your own uploads regardless of review state, without dumping a foreign receipt into an
// unrelated country's view. Deposit/fee lines and lines without a normalized unit price are
// excluded. Weekly medians split discounted from regular purchases, mirroring the public trend.
export class OwnPurchaseHistoryQueryAdapter implements IOwnPurchaseHistoryQuery {
  constructor(private readonly db: Pool | PoolClient) {}

  async history(input: OwnPurchaseQueryInput): Promise<OwnPurchaseLine[]> {
    const result = await this.db.query<WeeklyRow>(
      `WITH lines AS (
         SELECT l.product_id,
                date_trunc('week', i.transaction_date)::date AS week_start,
                (l.line_total / NULLIF(l.quantity, 0)) AS pack_price,
                l.normalized_unit_price,
                l.base_unit,
                l.is_discount,
                i.transaction_date
         FROM invoice_line l
         JOIN invoice i ON i.id = l.invoice_id
         WHERE l.product_id = ANY($1::uuid[])
           AND i.status IN ('PARSED', 'NEEDS_REVIEW')
           AND i.transaction_date IS NOT NULL
           AND i.transaction_date >= CURRENT_DATE - ($2::int * 7)
           AND l.line_total > 0
           AND l.quantity > 0
           AND l.is_deposit_or_fee = false
           AND (
             (i.location_status = 'RESOLVED'
                AND i.location_country_code = $3
                AND i.location_region_code = $4)
             OR (i.location_status <> 'RESOLVED'
                AND (i.location_country_code = $3 OR i.location_country_code IS NULL))
           )
       ),
       totals AS (
         SELECT product_id,
                COUNT(*) AS purchase_count,
                MAX(transaction_date) AS last_purchased_on,
                -- per-unit only when every own line has a per-unit price and one base unit;
                -- otherwise the product's own history is served as €/item (pack price).
                (COUNT(*) FILTER (WHERE normalized_unit_price IS NULL) = 0
                   AND COUNT(DISTINCT base_unit) = 1) AS unit_known,
                MIN(base_unit) AS base_unit
         FROM lines
         GROUP BY product_id
       ),
       weekly AS (
         SELECT l.product_id, l.week_start,
                percentile_cont(0.5) WITHIN GROUP (
                  ORDER BY CASE WHEN t.unit_known THEN l.normalized_unit_price ELSE l.pack_price END)
                  FILTER (WHERE NOT l.is_discount) AS median,
                percentile_cont(0.5) WITHIN GROUP (
                  ORDER BY CASE WHEN t.unit_known THEN l.normalized_unit_price ELSE l.pack_price END)
                  FILTER (WHERE l.is_discount) AS discount_median
         FROM lines l
         JOIN totals t ON t.product_id = l.product_id
         GROUP BY l.product_id, l.week_start
       )
       SELECT w.product_id,
              w.week_start::text AS week_start,
              w.median::text AS median,
              w.discount_median::text AS discount_median,
              t.purchase_count::text AS purchase_count,
              t.last_purchased_on::text AS last_purchased_on,
              CASE WHEN t.unit_known THEN t.base_unit ELSE NULL END AS unit
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
        unit: row.unit,
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
