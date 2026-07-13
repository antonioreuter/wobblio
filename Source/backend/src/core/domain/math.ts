// Shared numeric helpers so price aggregation stays consistent across the ambiguity detector and
// the comparison matrix (a divergent median would let the two disagree on the same prices).

// Median of an unsorted list. Copies before sorting (does not mutate the caller's array). Even-length
// lists average the two middle values. Caller must pass a non-empty list.
export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
