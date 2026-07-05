import { MIN_INFLATION_BASKET, type MatchedBasketItem } from './personalInflation';

// The sparkline behind the Home inflation card: a matched-basket price index over time, one point
// per calendar month, baselined to 100 at the earliest month. Each later month is the median of its
// per-product price ratios vs that SAME baseline month — matched-basket so the line tracks price
// change, not a change in what was bought. Personal (own invoices) and regional (price_observation)
// series are computed identically; only the source rows differ.

/// A product's median comparable price in one month bucket (YYYY-MM), from either source.
export interface MonthlyProductMedian {
  period: string; // 'YYYY-MM', sortable
  productId: string;
  median: number;
}

export interface InflationSeriesPoint {
  period: string; // 'YYYY-MM'
  /// 100-based index vs the baseline month; null when too few products match the baseline that
  /// month to be meaningful (honest gap — the line skips it rather than inventing a value).
  indexPct: number | null;
}

/// One overlaid sparkline point: the caller's index and their region's index for the same month.
/// Either may be null (thin data that month) — the client draws each line across its own points.
export interface InflationTrendPoint {
  period: string;
  personalIndexPct: number | null;
  regionIndexPct: number | null;
}

/// Overlay the personal and regional series onto a single, chronologically-ordered month axis
/// (the union of both series' months), so the client renders two lines against one x-axis.
export function mergeInflationSeries(
  personal: InflationSeriesPoint[],
  region: InflationSeriesPoint[],
): InflationTrendPoint[] {
  const personalByPeriod = new Map(personal.map((p) => [p.period, p.indexPct]));
  const regionByPeriod = new Map(region.map((p) => [p.period, p.indexPct]));
  const periods = [...new Set([...personalByPeriod.keys(), ...regionByPeriod.keys()])].sort();
  return periods.map((period) => ({
    period,
    personalIndexPct: personalByPeriod.get(period) ?? null,
    regionIndexPct: regionByPeriod.get(period) ?? null,
  }));
}

export function computeInflationSeries(
  rows: MonthlyProductMedian[],
  minBasket: number = MIN_INFLATION_BASKET,
): InflationSeriesPoint[] {
  const byPeriod = groupByPeriod(rows);
  const periods = [...byPeriod.keys()].sort();
  if (periods.length === 0) return [];

  const baseline = byPeriod.get(periods[0]) as Map<string, number>;
  return periods.map((period) => ({
    period,
    indexPct: indexVsBaseline(baseline, byPeriod.get(period) as Map<string, number>, minBasket),
  }));
}

function indexVsBaseline(
  baseline: Map<string, number>,
  current: Map<string, number>,
  minBasket: number,
): number | null {
  const basket: MatchedBasketItem[] = [];
  for (const [productId, currentMedian] of current) {
    const priorMedian = baseline.get(productId);
    if (priorMedian === undefined || priorMedian <= 0 || currentMedian <= 0) continue;
    basket.push({ productId, currentMedian, priorMedian });
  }
  if (basket.length < minBasket) return null;
  const ratios = basket.map((item) => item.currentMedian / item.priorMedian).sort((a, b) => a - b);
  return Math.round(median(ratios) * 1000) / 10; // 100-based, one decimal
}

function groupByPeriod(rows: MonthlyProductMedian[]): Map<string, Map<string, number>> {
  const byPeriod = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const products = byPeriod.get(row.period) ?? new Map<string, number>();
    products.set(row.productId, row.median);
    byPeriod.set(row.period, products);
  }
  return byPeriod;
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
