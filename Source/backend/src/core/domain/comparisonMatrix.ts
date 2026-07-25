import type { PriceCell, PriceMatrix, MerchantRef } from './routeOptimizer';
import { classifyComparability, type ComparabilityReason, type Offer, type OfferSize } from './comparability';
import { detectAmbiguity, type AmbiguityConfig } from './priceAmbiguity';
import { median } from './math';

// 09/05 — build the optimizer's price matrix over the user's product links. Per requested item,
// the row contains the item's own (product, merchant) cell plus ONLY the comparable AND unambiguous
// linked sibling cells, each RE-LABELED to the item's own productId so the pure
// route optimizer needs no change. Watch-only links (size not known-equal, no confirmation) and
// price-ambiguous cells never enter the matrix — the optimizer can never recommend switching stores
// on a 12-pack-vs-2L price. The per-item reason lets the UI explain instead of silently omitting.

export interface RawCell {
  productId: string;
  merchantId: string;
  merchantName: string;
  prices: number[]; // non-discounted pack prices in the trailing window (for median + ambiguity)
  lastObservedOn: string;
}

// A tenant product link from a requested item (self) to a sibling product (other).
export interface ComparisonLink {
  selfId: string;
  otherId: string;
  sizeEquivalent: boolean;
}

export interface ComparisonMatrixInput {
  requestedProductIds: string[];
  rawCells: RawCell[];
  sizes: Map<string, OfferSize>; // product_id → its catalog pack size
  links: ComparisonLink[];
  ambiguity: AmbiguityConfig;
  minObservations: number; // k≥3 serving gate
  userAverages: Record<string, number>;
}

export interface ComparisonMatrixResult {
  matrix: PriceMatrix;
  // Per requested product: why its siblings were (or weren't) folded into its row.
  reasons: Map<string, ComparabilityReason>;
}

interface Cell {
  merchantId: string;
  merchantName: string;
  median: number;
  count: number;
  ambiguous: boolean;
  lastObservedOn: string;
}

export function buildComparisonMatrix(input: ComparisonMatrixInput): ComparisonMatrixResult {
  // Reduce raw observations to one derived cell per (product, merchant): median, density, ambiguity.
  const cellsByProduct = new Map<string, Cell[]>();
  for (const raw of input.rawCells) {
    if (raw.prices.length < input.minObservations) continue;
    const cell: Cell = {
      merchantId: raw.merchantId,
      merchantName: raw.merchantName,
      median: median(raw.prices),
      count: raw.prices.length,
      ambiguous: detectAmbiguity(raw.prices, input.ambiguity).ambiguous,
      lastObservedOn: raw.lastObservedOn,
    };
    const list = cellsByProduct.get(raw.productId) ?? [];
    list.push(cell);
    cellsByProduct.set(raw.productId, list);
  }

  const offerFor = (productId: string): Offer => ({
    size: input.sizes.get(productId) ?? { packSize: null, baseUnit: null },
    sizeEquivalent: false,
    // A product's own ambiguity is true when ANY of its cells is ambiguous (per-merchant identity
    // means one cell in practice, but be defensive).
    ambiguous: (cellsByProduct.get(productId) ?? []).some((c) => c.ambiguous),
  });

  const outCells: PriceCell[] = [];
  const merchants = new Map<string, MerchantRef>();
  const reasons = new Map<string, ComparabilityReason>();
  const seen = new Set<string>(); // (requestedProduct, merchant) dedupe

  const includeCell = (targetProductId: string, cell: Cell): void => {
    if (cell.ambiguous) return;
    const dedupeKey = `${targetProductId}|${cell.merchantId}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    outCells.push({
      productId: targetProductId,
      merchantId: cell.merchantId,
      price: cell.median,
      observationCount: cell.count,
      lastObservedOn: cell.lastObservedOn,
    });
    merchants.set(cell.merchantId, { id: cell.merchantId, name: cell.merchantName });
  };

  for (const productId of input.requestedProductIds) {
    const self = offerFor(productId);
    // The item's own cells always price at their own merchant (unless ambiguous).
    for (const cell of cellsByProduct.get(productId) ?? []) includeCell(productId, cell);

    const myLinks = input.links.filter((l) => l.selfId === productId);
    let reason: ComparabilityReason = myLinks.length === 0 ? 'no_link' : 'watch_only';
    for (const link of myLinks) {
      const other: Offer = { ...offerFor(link.otherId), sizeEquivalent: link.sizeEquivalent };
      const verdict = classifyComparability(self, other);
      if (verdict === 'comparable') {
        for (const cell of cellsByProduct.get(link.otherId) ?? []) includeCell(productId, cell);
        reason = 'comparable';
      } else if (verdict === 'ambiguous' && reason !== 'comparable') {
        reason = 'ambiguous';
      }
    }
    reasons.set(productId, reason);
  }

  return {
    matrix: { merchants: [...merchants.values()], cells: outCells, userAverages: input.userAverages },
    reasons,
  };
}
