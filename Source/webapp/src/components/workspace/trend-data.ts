// §6.5.1 comparison chart constants. The series themselves come from the live price
// observation store via use-price-trends; this module only holds presentation tokens.

import type { Preset } from './invoice-data'

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
