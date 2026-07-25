// §6.5.1 comparison chart constants. The series themselves come from the live price
// observation store via use-price-trends; this module only holds presentation tokens.

import type { Preset } from './invoice-data'
import type { TrendComparison, TrendPoint } from './use-price-trends'

export const SERIES_COLORS = [
  '#6366f1', '#0d9488', '#f59e0b', '#f43f5e',
  '#8b5cf6', '#0ea5e9', '#22c55e', '#ec4899', '#eab308',
]

export const MAX_PRODUCTS = 3

// Index-based rotation through the palette (3rd occurrence of this pattern —
// reports/page.tsx has two inline uses — so it's pulled out per Rule of Three).
export const seriesColor = (index: number): string => SERIES_COLORS[index % SERIES_COLORS.length]

// Reports-local presets. The shared `Preset`/`PRESETS` (invoice-data) also drive the
// invoices spend filter — the price-trends report is the only surface that needs the
// 6-month window (the backend serves 26 weeks), so it's widened here, not the shared type.
export type TrendPreset = Preset | '6m'
export const TREND_PRESETS: Array<[TrendPreset, string]> = [
  ['30d', 'Last 30 days'],
  ['month', 'This month'],
  ['90d', 'Last 3 months'],
  ['6m', 'Last 6 months'],
  ['custom', 'Custom range'],
]

export function daysBack(n: number): Date {
  return new Date(Date.now() - n * 86_400_000)
}

// §6.5.5 own-mode personal-history affordance for a product's legend row, from its last two
// regular-price purchase events. `first` → the first-purchase message; `delta` → "▲/▼ N% vs
// previous scan" (pct signed, up = paid more); `priceOnly` → ≥2 purchases but no comparable
// previous scan (e.g. only one regular scan among discounts), so just the last-paid price.
export type PersonalHistory =
  | { kind: 'first' }
  | { kind: 'delta'; pct: number }
  | { kind: 'priceOnly' }

export function personalHistory(input: {
  lastPrice: number | null
  previousPrice: number | null
  purchaseCount: number
}): PersonalHistory {
  if (input.purchaseCount <= 1) return { kind: 'first' }
  if (input.lastPrice !== null && input.previousPrice !== null && input.previousPrice !== 0) {
    return { kind: 'delta', pct: ((input.lastPrice - input.previousPrice) / input.previousPrice) * 100 }
  }
  return { kind: 'priceOnly' }
}

// Filters a week (UTC midnight of its Monday) to the active preset. All comparisons are UTC:
// the caller builds the week axis from `${weekStart}T00:00:00Z`, so mixing in local-time month
// math would mis-include or drop a week near a month boundary.
export function inRange(
  d: Date,
  preset: TrendPreset,
  from: string,
  to: string,
  rangeInvalid: boolean,
): boolean {
  const today = new Date()
  if (preset === '30d') return d >= daysBack(30)
  if (preset === '6m') return d >= daysBack(183)
  if (preset === 'month')
    return d.getUTCMonth() === today.getUTCMonth() && d.getUTCFullYear() === today.getUTCFullYear()
  if (preset === 'custom' && !rangeInvalid && from && to)
    return d >= new Date(from) && d <= new Date(to)
  return d >= daysBack(90)
}

// Fix 10 auto-fallbacks — be opinionated so a selection never lands on a blank chart when data
// exists in the other mode or a wider range. Both are pure so the page can call them in an effect
// and unit-test the decision without a DOM.

type CompareMode = 'own' | 'market'

// If the active mode has no source lines but the other mode does, return the mode to switch to.
// null when the active mode already has data or neither mode does (nothing to gain by switching).
export function resolveAutoMode(comparison: TrendComparison | null, mode: CompareMode): CompareMode | null {
  if (!comparison) return null
  const active = mode === 'market' ? comparison.lines : comparison.ownHistory
  const other = mode === 'market' ? comparison.ownHistory : comparison.lines
  if (active.length > 0 || other.length === 0) return null
  return mode === 'market' ? 'own' : 'market'
}

// If the active preset hides every point but the 26-week window does hold points, return '6m' to
// widen to the full window. null when the preset already shows points or there are none at all.
export function widenRangeIfHidden(
  pointsSets: TrendPoint[][],
  preset: TrendPreset,
  from: string,
  to: string,
  rangeInvalid: boolean,
): TrendPreset | null {
  if (preset === '6m' || preset === 'custom') return null
  let anyInWindow = false
  let anyInPreset = false
  for (const points of pointsSets) {
    for (const pt of points) {
      if (pt.median === null && pt.discountMedian === null) continue
      anyInWindow = true
      if (inRange(new Date(`${pt.weekStart}T00:00:00Z`), preset, from, to, rangeInvalid)) anyInPreset = true
    }
  }
  return anyInWindow && !anyInPreset ? '6m' : null
}
