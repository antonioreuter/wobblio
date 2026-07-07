// Shared categorical palette for the spend-breakdown donut + bar accents. Deterministic by
// index so a category keeps the same colour between the donut and the ranked list.
export const SPEND_COLORS = [
  '#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4',
  '#8b5cf6', '#ef4444', '#14b8a6', '#eab308', '#3b82f6',
  '#f97316', '#a855f7',
]

export function spendColor(index: number): string {
  return SPEND_COLORS[index % SPEND_COLORS.length]
}
