import type { Pool, PoolClient } from 'pg';
import type {
  IOwnPurchaseHistoryQuery,
  OwnPurchaseLine,
  OwnPurchaseQueryInput,
  OwnRegionCurrencyInput,
} from '@core/ports/data-intelligence/IOwnPurchaseHistoryQuery';

import type { BaseUnit } from '@core/domain/unitSize';
import { currencyFilter } from './queryFilters';

interface WeeklyRow {
  product_id: string;
  week_start: string;
  median: string | null;
  discount_median: string | null;
  purchase_count: string;
  last_purchased_on: string;
  last_price: string | null;
  previous_price: string | null;
  unit: BaseUnit | null;
}

// The caller's OWN purchase history over the RLS-scoped invoice_line store — the db
// MUST already carry the tenant context (see withTenantTx). No k≥3 gate: own data is
// served regardless of public quorum, which is the whole point. Location match: a
// RESOLVED receipt must match the picker country+region (same as the public store would
// emit to); a receipt still pending location review (location_status <> 'RESOLVED', region
// NULL) is also served when its country is unknown or matches the picker — full access to
// your own uploads regardless of review state, without dumping a foreign receipt into an
// unrelated country's view. Invoices in a currency other than the view currency are excluded so a
// foreign-currency pending receipt can't leak in. Deposit/fee lines are excluded; each line's
// price is the per-unit price when a pack size is known, otherwise the pack price (line_total /
// quantity). Weekly medians split discounted from regular purchases, mirroring the public trend.
export class OwnPurchaseHistoryQueryAdapter implements IOwnPurchaseHistoryQuery {
  constructor(private readonly db: Pool | PoolClient) {}

  async history(input: OwnPurchaseQueryInput): Promise<OwnPurchaseLine[]> {
    // Currency honesty: exclude invoices in another currency. A NULL invoice.currency (unparsed)
    // never matches `=`, which is correct — it has no trustworthy price yet. Omitted only when the
    // view currency couldn't be resolved.
    const params: unknown[] = [input.productIds, input.weeks, input.countryCode, input.regionCode];
    const currencyClause = currencyFilter('i.currency', input.currency, params);

    const result = await this.db.query<WeeklyRow>(
      `WITH lines AS (
         SELECT l.product_id,
                date_trunc('week', i.transaction_date)::date AS week_start,
                (l.line_total / NULLIF(l.quantity, 0)) AS pack_price,
                l.normalized_unit_price,
                l.base_unit,
                l.is_discount,
                i.transaction_date,
                i.created_at AS invoice_created_at,
                i.id AS invoice_id,
                l.id AS line_id
         FROM invoice_line l
         JOIN invoice i ON i.id = l.invoice_id
         WHERE l.product_id = ANY($1::uuid[])
           AND i.status IN ('PARSED', 'NEEDS_REVIEW')
           AND i.transaction_date IS NOT NULL
           AND i.transaction_date >= CURRENT_DATE - ($2::int * 7)
           AND l.line_total > 0
           AND l.quantity > 0
           AND l.is_deposit_or_fee = false
           ${currencyClause}
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
       ),
       -- Per-line unit-consistent price (same €/unit-vs-€/item decision as the medians).
       priced AS (
         SELECT l.product_id, l.transaction_date, l.invoice_created_at, l.invoice_id, l.line_id,
                l.is_discount,
                CASE WHEN t.unit_known THEN l.normalized_unit_price ELSE l.pack_price END AS unit_price
         FROM lines l
         JOIN totals t ON t.product_id = l.product_id
       ),
       has_regular AS (
         SELECT product_id, bool_or(NOT is_discount) AS any_regular FROM priced GROUP BY product_id
       ),
       -- "Last paid": rank the regular-price scans most-recent-first; fall back to discounted scans
       -- only for a product with no regular scan at all, so "last paid" matches the next expected
       -- shelf price. Same-day ties broken deterministically by invoice created_at, then id.
       ranked AS (
         SELECT p.product_id, p.unit_price,
                row_number() OVER (
                  PARTITION BY p.product_id
                  ORDER BY p.transaction_date DESC, p.invoice_created_at DESC, p.invoice_id DESC, p.line_id DESC
                ) AS rn
         FROM priced p
         JOIN has_regular h ON h.product_id = p.product_id
         WHERE (h.any_regular AND NOT p.is_discount) OR NOT h.any_regular
       ),
       recent AS (
         SELECT product_id,
                MAX(unit_price) FILTER (WHERE rn = 1) AS last_price,
                MAX(unit_price) FILTER (WHERE rn = 2) AS previous_price
         FROM ranked WHERE rn <= 2 GROUP BY product_id
       )
       SELECT w.product_id,
              w.week_start::text AS week_start,
              w.median::text AS median,
              w.discount_median::text AS discount_median,
              t.purchase_count::text AS purchase_count,
              t.last_purchased_on::text AS last_purchased_on,
              r.last_price::text AS last_price,
              r.previous_price::text AS previous_price,
              CASE WHEN t.unit_known THEN t.base_unit ELSE NULL END AS unit
       FROM weekly w
       JOIN totals t ON t.product_id = w.product_id
       LEFT JOIN recent r ON r.product_id = w.product_id
       ORDER BY w.product_id, w.week_start`,
      params,
    );

    return groupIntoLines(result.rows);
  }

  // Most frequent currency across the caller's OWN receipts in the region (RLS-scoped). Used to
  // pick the view currency for an unmapped country so the currency filter never hides the user's
  // own purchases behind a public-store guess (own history is the day-1 value hook, never gated).
  // null when the caller has no parsed own receipts here.
  async modalCurrency(input: OwnRegionCurrencyInput): Promise<string | null> {
    const result = await this.db.query<{ currency: string }>(
      `SELECT i.currency
         FROM invoice_line l
         JOIN invoice i ON i.id = l.invoice_id
        WHERE l.product_id = ANY($1::uuid[])
          AND i.status IN ('PARSED', 'NEEDS_REVIEW')
          AND i.transaction_date IS NOT NULL
          AND i.transaction_date >= CURRENT_DATE - ($2::int * 7)
          AND i.currency IS NOT NULL
          AND (
            (i.location_status = 'RESOLVED'
               AND i.location_country_code = $3
               AND i.location_region_code = $4)
            OR (i.location_status <> 'RESOLVED'
               AND (i.location_country_code = $3 OR i.location_country_code IS NULL))
          )
        GROUP BY i.currency
        ORDER BY COUNT(*) DESC, i.currency ASC
        LIMIT 1`,
      [input.productIds, input.weeks, input.countryCode, input.regionCode],
    );
    return result.rows[0]?.currency ?? null;
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
        lastPrice: row.last_price === null ? null : parseFloat(row.last_price),
        previousPrice: row.previous_price === null ? null : parseFloat(row.previous_price),
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
