import { median } from './math';

// 09/05 — price-ambiguity flag (same-name collision detection). At one merchant a single product
// name can cover two physically different SKUs (e.g. a 12x33cl and a 2L cola), producing a bimodal
// price history. Such a cell is flagged, shown as a range, and excluded from ranking + the optimizer
// matrix. Detection is read-time over a (product, merchant) cell's trailing-26-week, non-quarantined,
// non-discounted observations (discounts are promos, not ambiguity, so they're excluded upstream).

export interface AmbiguityConfig {
  gapPct: number; // cluster-median gap above which the cell is ambiguous (e.g. 0.40 = 40%)
}

export interface AmbiguityResult {
  ambiguous: boolean;
  low: number | null; // lower cluster median (for the "€X–€Y" range copy)
  high: number | null; // upper cluster median
}

const MIN_CLUSTER = 3; // each side of the split needs at least this many observations

// Split the sorted prices at the median into a low and high cluster (1-D 2-means degenerates to a
// median split for one dimension), then flag when BOTH clusters are dense (≥3) and their medians
// differ by more than the configured gap. Fewer than 6 points can never be bimodal-with-density.
export function detectAmbiguity(prices: number[], config: AmbiguityConfig): AmbiguityResult {
  const clean = prices.filter((p) => p > 0).sort((a, b) => a - b);
  if (clean.length < MIN_CLUSTER * 2) return { ambiguous: false, low: null, high: null };

  const mid = Math.floor(clean.length / 2);
  const lowCluster = clean.slice(0, mid);
  const highCluster = clean.slice(mid);
  if (lowCluster.length < MIN_CLUSTER || highCluster.length < MIN_CLUSTER) {
    return { ambiguous: false, low: null, high: null };
  }

  const low = median(lowCluster);
  const high = median(highCluster);
  // Guard low === 0 (filtered above, but defensive): a zero base would make the gap infinite.
  const gap = low > 0 ? (high - low) / low : 0;
  return { ambiguous: gap > config.gapPct, low, high };
}
