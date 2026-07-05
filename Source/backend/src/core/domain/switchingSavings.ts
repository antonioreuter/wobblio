// "€ saved by shopping smart" for the Home inflation card: for each of the caller's own purchases in
// the window, how much they paid BELOW their region's median price for that product, summed. Only
// under-median lines count (paying above the median isn't a saving); the region median is the
// honest counterfactual "typical" price. Null when nothing is comparable — never a fabricated 0.

export interface SavingsLine {
  paidUnitPrice: number; // €/pack the caller actually paid on this line
  regionMedian: number; // regional median €/pack for the same product
  quantity: number;
}

export function computeSwitchingSavings(lines: SavingsLine[]): number | null {
  const comparable = lines.filter(
    (line) => line.paidUnitPrice > 0 && line.regionMedian > 0 && line.quantity > 0,
  );
  if (comparable.length === 0) return null;

  const saved = comparable.reduce(
    (total, line) => total + Math.max(0, line.regionMedian - line.paidUnitPrice) * line.quantity,
    0,
  );
  return Math.round(saved * 100) / 100;
}
