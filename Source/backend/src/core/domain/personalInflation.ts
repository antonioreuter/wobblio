// Personal inflation = a matched-basket price index over the caller's OWN purchases: for each
// product they bought in BOTH the current period and the prior one, the ratio of its median price
// now vs then, aggregated by the median of those ratios. Median-of-ratios (not mean) so one product
// doubling in price doesn't swing the headline, and matched-basket so it measures price change, not
// a change in WHAT was bought. This is the §6 "Anti-Inflation Price Engine" surfaced as one number.

/// One product present in both compared periods, with its median comparable price in each. Prices
/// are €/unit when the pack size is known for every line, else €/item — the query guarantees both
/// medians for a product use the same basis, so their ratio is dimensionless either way.
export interface MatchedBasketItem {
  productId: string;
  currentMedian: number;
  priorMedian: number;
}

export interface PersonalInflationResult {
  /// Signed % change of the caller's matched basket; null when the basket is too small to be
  /// meaningful (honest empty state — never a fabricated 0%).
  personalInflationPct: number | null;
  /// How many products actually matched both periods (drives the empty-state copy).
  basketSize: number;
}

/// Smallest matched basket we'll publish a number for — below this, one product dominates and the
/// index is noise.
export const MIN_INFLATION_BASKET = 3;

export function computePersonalInflation(
  basket: MatchedBasketItem[],
  minBasket: number = MIN_INFLATION_BASKET,
): PersonalInflationResult {
  const ratios = basket
    .filter((item) => item.priorMedian > 0 && item.currentMedian > 0)
    .map((item) => item.currentMedian / item.priorMedian);

  if (ratios.length < minBasket) {
    return { personalInflationPct: null, basketSize: ratios.length };
  }

  const pct = (median(ratios) - 1) * 100;
  // One decimal, matching the prototype's "+0.2%" and avoiding false precision.
  return { personalInflationPct: Math.round(pct * 10) / 10, basketSize: ratios.length };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
