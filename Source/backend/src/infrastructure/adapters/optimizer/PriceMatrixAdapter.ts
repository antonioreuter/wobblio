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
// Ceiling on accepted sibling links folded into the matrix per request — bounds the priced-product
// fan-out (replaces the old comparison-set 5-member cap, which no longer exists).
const MAX_LINK_EXPANSION = 24;

interface CellRow {
  product_id: string;
  merchant_id: string;
  merchant_name: string;
  prices: string[]; // non-discounted pack prices in the window (numeric[] → string[])
  last_observed_on: string;
}

interface LinkRow {
  product_a_id: string;
  product_b_id: string;
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

// 09/05 optimizer matrix. price_observation is the global, RLS-exempt store; the product_link
// links and userAverages come from the caller's RLS-scoped tables, so tenant context MUST be set
// (withTenantTx). Per requested item the matrix carries its own cell plus ONLY comparable AND
// unambiguous sibling cells (from accepted product links, fix 10), relabeled to the item's
// productId. The pure route optimizer (routeOptimizer.ts) is unchanged — only its input changes.
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

    // Tenant product links touching a requested item, expanded to directional links from the
    // requested item (self) to its sibling (other). One canonical row (a < b) serves both
    // directions; when both endpoints are requested, both directions are emitted. Bounded to the
    // most-recent MAX_LINK_EXPANSION links so a user who accepted many suggestions can't fan the
    // priced-product set (and the per-cell/size/avg queries below) out without limit on t3.micro.
    const linkRows = await this.client.query<LinkRow>(
      `SELECT product_a_id, product_b_id, size_equivalent
       FROM product_link
       WHERE status = 'ACCEPTED'
         AND (product_a_id = ANY($1::uuid[]) OR product_b_id = ANY($1::uuid[]))
       ORDER BY updated_at DESC
       LIMIT ${MAX_LINK_EXPANSION}`,
      [productIds],
    );
    const requested = new Set(productIds);
    const links: ComparisonLink[] = [];
    for (const r of linkRows.rows) {
      if (requested.has(r.product_a_id)) {
        links.push({ selfId: r.product_a_id, otherId: r.product_b_id, sizeEquivalent: r.size_equivalent });
      }
      if (requested.has(r.product_b_id)) {
        links.push({ selfId: r.product_b_id, otherId: r.product_a_id, sizeEquivalent: r.size_equivalent });
      }
    }

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
