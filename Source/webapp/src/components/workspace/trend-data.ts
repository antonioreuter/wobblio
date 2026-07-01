// §6.5.1 comparison chart constants. The series themselves come from the live price
// observation store via use-price-trends; this module only holds presentation tokens.

export const SERIES_COLORS = [
  '#6366f1', '#0d9488', '#f59e0b', '#f43f5e',
  '#8b5cf6', '#0ea5e9', '#22c55e', '#ec4899', '#eab308',
]

export const MAX_PRODUCTS = 3

// Index-based rotation through the palette (3rd occurrence of this pattern —
// reports/page.tsx has two inline uses — so it's pulled out per Rule of Three).
export const seriesColor = (index: number): string => SERIES_COLORS[index % SERIES_COLORS.length]
