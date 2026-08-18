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

// A range of whole weeks, each identified by the UTC-midnight Monday that starts it — the same key
// the backend emits as `weekStart`, so range maths never mixes a timestamp with a date.
export interface WeekRange {
  startWeek: string
  endWeek: string
}

const DAY_MS = 86_400_000

// Midnight UTC of the calendar day a Date falls on. Dropping the time-of-day is what makes
// "last 30 days" mean 30 whole days rather than 29 days plus however far into today it is.
function utcMidnight(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

// The Monday that starts the week containing `date`, as an ISO date.
export function mondayOf(date: Date): string {
  const day = utcMidnight(date)
  const backToMonday = (new Date(day).getUTCDay() + 6) % 7 // getUTCDay: 0 = Sunday
  return new Date(day - backToMonday * DAY_MS).toISOString().slice(0, 10)
}

// The whole weeks a preset covers. Both bounds are snapped to their week's Monday, which gives the
// range OVERLAP semantics: a week whose Monday predates the range start is still included when it
// holds in-range days. Filtering on the Monday alone would drop such a week entirely.
export function resolveWeekRange(
  preset: TrendPreset,
  from: string,
  to: string,
  rangeInvalid: boolean,
  today: Date = new Date(),
): WeekRange {
  const end = utcMidnight(today)
  if (preset === 'custom' && !rangeInvalid && from && to) {
    return { startWeek: mondayOf(new Date(`${from}T00:00:00Z`)), endWeek: mondayOf(new Date(`${to}T00:00:00Z`)) }
  }
  if (preset === 'month') {
    const firstOfMonth = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)
    return { startWeek: mondayOf(new Date(firstOfMonth)), endWeek: mondayOf(new Date(end)) }
  }
  const span = preset === '30d' ? 30 : preset === '6m' ? 183 : 90
  return { startWeek: mondayOf(new Date(end - span * DAY_MS)), endWeek: mondayOf(new Date(end)) }
}

export function weekInRange(weekStart: string, range: WeekRange): boolean {
  return weekStart >= range.startWeek && weekStart <= range.endWeek
}

// Every Monday from `startWeek` to `endWeek` inclusive — the continuous axis. Weeks with no
// observation must exist on it, otherwise a five-month gap renders as two adjacent points.
export function buildWeekAxis(startWeek: string, endWeek: string): string[] {
  const weeks: string[] = []
  for (let t = Date.parse(`${startWeek}T00:00:00Z`); t <= Date.parse(`${endWeek}T00:00:00Z`); t += 7 * DAY_MS) {
    weeks.push(new Date(t).toISOString().slice(0, 10))
  }
  return weeks
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
  priorPurchaseExists?: boolean
}): PersonalHistory {
  // A product bought before the window is never a first purchase, however few times it appears
  // inside it.
  if (!input.priorPurchaseExists && input.purchaseCount <= 1) return { kind: 'first' }
  if (input.lastPrice !== null && input.previousPrice !== null && input.previousPrice !== 0) {
    return { kind: 'delta', pct: ((input.lastPrice - input.previousPrice) / input.previousPrice) * 100 }
  }
  return { kind: 'priceOnly' }
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
  const range = resolveWeekRange(preset, from, to, rangeInvalid)
  let anyInWindow = false
  let anyInPreset = false
  for (const points of pointsSets) {
    for (const pt of points) {
      if (pt.median === null && pt.discountMedian === null) continue
      anyInWindow = true
      if (weekInRange(pt.weekStart, range)) anyInPreset = true
    }
  }
  return anyInWindow && !anyInPreset ? '6m' : null
}
