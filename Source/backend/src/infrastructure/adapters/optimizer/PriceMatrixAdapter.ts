import type { PoolClient } from 'pg';
import type { IPriceMatrix, PriceMatrixResult } from '@core/ports/optimizer/IPriceMatrix';
import type { IAmbiguityConfig } from '@core/ports/data-intelligence/IAmbiguityConfig';
import type { OwnHistoryBasketTotal } from '@core/domain/routeOptimizer';
import type { BaseUnit } from '@core/domain/unitSize';
import type { OfferSize } from '@core/domain/comparability';
import { buildComparisonMatrix, type ComparisonLink, type RawCell } from '@core/domain/comparisonMatrix';

// §6.5 serving quorum + trailing window (mirrors the trend/serving gates).
const MIN_OBSERVATIONS = 3;
const WINDOW_WEEKS = 26;

interface CellRow {
  product_id: string;
  merchant_id: string;
  merchant_name: string;
  prices: string[]; // non-discounted pack prices in the window (numeric[] → string[])
  last_observed_on: string;
}

interface LinkRow {
  self_id: string;
  other_id: string;
  size_equivalent: boolean;
}

interface SizeRow {
  id: string;
  pack_size_base_units: string | null;
  base_unit: BaseUnit | null;
}

interface AvgRow {
  product_id: string;
  avg_price: string;
}

// 09/05 optimizer matrix. price_observation is the global, RLS-exempt store; the comparison-set
// links and userAverages come from the caller's RLS-scoped tables, so tenant context MUST be set
// (withTenantTx). Per requested item the matrix carries its own cell plus ONLY comparable AND
// unambiguous comparison-set sibling cells, relabeled to the item's productId. The pure route
// optimizer (routeOptimizer.ts) is unchanged — only its input changes.
export class PriceMatrixAdapter implements IPriceMatrix {
  constructor(
    private readonly client: PoolClient,
    private readonly ambiguityConfig: IAmbiguityConfig,
  ) {}

  async build(
    productIds: string[],
    regionCode: string,
    countryCode: string,
    currency: string,
  ): Promise<PriceMatrixResult> {
    if (productIds.length === 0) return { matrix: { merchants: [], cells: [], userAverages: {} }, reasons: {} };

    // Tenant comparison-set links from a requested item (self) to its sibling products (other).
    const linkRows = await this.client.query<LinkRow>(
      `SELECT ms.product_id AS self_id, mo.product_id AS other_id, mo.size_equivalent
       FROM product_comparison_set_member ms
       JOIN product_comparison_set_member mo
         ON mo.set_id = ms.set_id AND mo.product_id <> ms.product_id
       WHERE ms.product_id = ANY($1::uuid[])`,
      [productIds],
    );
    const links: ComparisonLink[] = linkRows.rows.map((r) => ({
      selfId: r.self_id, otherId: r.other_id, sizeEquivalent: r.size_equivalent,
    }));

    // Everything that could be priced: the requested items plus their linked siblings.
    const allProductIds = [...new Set([...productIds, ...links.map((l) => l.otherId)])];

    const cellRows = await this.client.query<CellRow>(
      `SELECT po.product_id, po.merchant_id, m.brand_name AS merchant_name,
              array_agg(po.pack_price::text) FILTER (WHERE NOT po.was_discounted) AS prices,
              max(po.observed_on)::text AS last_observed_on
       FROM price_observation po
       JOIN merchant m ON m.id = po.merchant_id
       WHERE po.region_code = $2 AND po.country_code = $3 AND po.currency = $4
         AND po.product_id = ANY($1::uuid[]) AND po.quarantined = false
         AND po.observed_on >= CURRENT_DATE - (${WINDOW_WEEKS} * 7)
       GROUP BY po.product_id, po.merchant_id, m.brand_name`,
      [allProductIds, regionCode, countryCode, currency],
    );
    const rawCells: RawCell[] = cellRows.rows.map((r) => ({
      productId: r.product_id,
      merchantId: r.merchant_id,
      merchantName: r.merchant_name,
      prices: (r.prices ?? []).map((p) => parseFloat(p)),
      lastObservedOn: r.last_observed_on,
    }));

    const sizeRows = await this.client.query<SizeRow>(
      `SELECT id, pack_size_base_units::text AS pack_size_base_units, base_unit
       FROM product WHERE id = ANY($1::uuid[])`,
      [allProductIds],
    );
    const sizes = new Map<string, OfferSize>(
      sizeRows.rows.map((r) => [r.id, {
        packSize: r.pack_size_base_units === null ? null : parseFloat(r.pack_size_base_units),
        baseUnit: r.base_unit,
      }]),
    );

    const avgRows = await this.client.query<AvgRow>(
      `SELECT l.product_id, avg(l.line_total / NULLIF(l.quantity, 0))::text AS avg_price
       FROM invoice_line l
       JOIN invoice i ON i.id = l.invoice_id
       WHERE l.product_id = ANY($1::uuid[]) AND i.status IN ('PARSED', 'NEEDS_REVIEW')
         AND i.currency = $2
       GROUP BY l.product_id`,
      [productIds, currency],
    );
    const userAverages: Record<string, number> = {};
    for (const row of avgRows.rows) {
      if (row.avg_price !== null) userAverages[row.product_id] = parseFloat(row.avg_price);
    }

    const ambiguity = await this.ambiguityConfig.get();
    const { matrix, reasons } = buildComparisonMatrix({
      requestedProductIds: productIds,
      rawCells,
      sizes,
      links,
      ambiguity,
      minObservations: MIN_OBSERVATIONS,
      userAverages,
    });
    return { matrix, reasons: Object.fromEntries(reasons) };
  }

  async ownHistoryBasket(productIds: string[], currency: string): Promise<OwnHistoryBasketTotal[]> {
    if (productIds.length === 0) return [];
    const result = await this.client.query<{ merchant_id: string; name: string; items_priced: string; total: string }>(
      `SELECT per.merchant_id, m.brand_name AS name,
              count(*)::text AS items_priced, sum(per.avg_price)::text AS total
       FROM (
         SELECT i.merchant_id AS merchant_id, l.product_id,
                avg(l.line_total / NULLIF(l.quantity, 0)) AS avg_price
         FROM invoice_line l JOIN invoice i ON i.id = l.invoice_id
         WHERE l.product_id = ANY($1::uuid[]) AND i.status IN ('PARSED', 'NEEDS_REVIEW')
           AND i.currency = $2 AND i.merchant_id IS NOT NULL
         GROUP BY i.merchant_id, l.product_id
       ) per
       JOIN merchant m ON m.id = per.merchant_id
       GROUP BY per.merchant_id, m.brand_name
       ORDER BY total ASC`,
      [productIds, currency],
    );
    return result.rows.map((r) => ({
      merchantId: r.merchant_id,
      name: r.name,
      total: Math.round(parseFloat(r.total) * 100) / 100,
      itemsPriced: parseInt(r.items_priced, 10),
    }));
  }
}
