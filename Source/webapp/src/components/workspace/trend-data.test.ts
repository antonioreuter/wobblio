import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  personalHistory,
  resolveAutoMode,
  resolveWeekRange,
  weekInRange,
  widenRangeIfHidden,
  mondayOf,
  TREND_PRESETS,
  type TrendPreset,
} from './trend-data'
import type { TrendComparison, TrendPoint } from './use-price-trends'

// A week is represented by the UTC midnight of its Monday, exactly as the reports page
// builds the axis (`${weekStart}T00:00:00Z`).
const week = (offsetDays: number): Date =>
  new Date(Date.UTC(2026, 6, 5) - offsetDays * 86_400_000) // anchor: 2026-07-05 (a Sunday)

afterEach(() => {
  vi.useRealTimers()
})

describe('TREND_PRESETS', () => {
  it('exposes the 6-month window as a distinct preset', () => {
    const values = TREND_PRESETS.map(([v]) => v)
    expect(values).toContain('6m')
    // ordered right after the 3-month preset so the picker reads shortest → longest.
    expect(values.indexOf('6m')).toBe(values.indexOf('90d') + 1)
  })
})

// The window logic that used to be one `inRange(date, …)` predicate is now two steps —
// `resolveWeekRange` produces the week bounds, `weekInRange` tests membership — so these
// assertions compose them. Same behaviour, same cases as the predicate they replaced.
const covers = (date: Date, preset: TrendPreset, from = '', to = '', rangeInvalid = false): boolean =>
  weekInRange(mondayOf(date), resolveWeekRange(preset, from, to, rangeInvalid))

describe('resolveWeekRange + weekInRange', () => {
  it('excludes a 150-day-old week under 90d but includes it under 6m', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-05T12:00:00Z'))
    const old = week(150)
    expect(covers(old, '90d')).toBe(false)
    expect(covers(old, '6m')).toBe(true)
  })

  it('includes the full 6-month window but excludes beyond it', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-05T12:00:00Z'))
    expect(covers(week(180), '6m')).toBe(true)
    expect(covers(week(200), '6m')).toBe(false)
  })

  it('month preset keeps only current-UTC-month weeks', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-20T12:00:00Z'))
    expect(covers(new Date('2026-07-06T00:00:00Z'), 'month')).toBe(true)
    expect(covers(new Date('2026-06-22T00:00:00Z'), 'month')).toBe(false)
  })

  it('month preset is stable across a month boundary in a non-UTC-aligned instant', () => {
    // Just after UTC midnight on the 1st: a local-time (getMonth) comparison would still
    // read the previous month in negative-offset zones and wrongly drop the new-month week.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01T00:30:00Z'))
    expect(covers(new Date('2026-08-01T00:00:00Z'), 'month')).toBe(true)
    expect(covers(new Date('2026-07-20T00:00:00Z'), 'month')).toBe(false)
  })

  it('snaps bounds to Mondays so a week straddling the range start is still covered', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-20T12:00:00Z'))
    // 2026-07-01 is a Wednesday; its week starts Monday 2026-06-29, before the month's first
    // day. Overlap semantics keep that week — filtering on the Monday alone would drop it.
    expect(resolveWeekRange('month', '', '', false).startWeek).toBe('2026-06-29')
    expect(covers(new Date('2026-06-29T00:00:00Z'), 'month')).toBe(true)
  })

  it('honours a valid custom range and ignores an invalid one (falls back to 90d)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-05T12:00:00Z'))
    const d = new Date('2026-05-10T00:00:00Z')
    expect(covers(d, 'custom', '2026-05-01', '2026-05-31')).toBe(true)
    expect(covers(d, 'custom', '2026-06-01', '2026-06-30')).toBe(false)
    // rangeInvalid → the custom branch is skipped and the default 90d window applies.
    expect(covers(week(150), 'custom', '2026-01-01', '2026-12-31', true)).toBe(false)
  })
})

describe('personalHistory', () => {
  it('reports a signed scan-to-scan delta for ≥2 purchases', () => {
    const h = personalHistory({ lastPrice: 1.32, previousPrice: 1.2, purchaseCount: 2 })
    expect(h.kind).toBe('delta')
    if (h.kind === 'delta') expect(h.pct).toBeCloseTo(10, 5) // paid 10% more
  })

  it('marks a downward move (negative pct) for a cheaper re-purchase', () => {
    const h = personalHistory({ lastPrice: 0.9, previousPrice: 1.0, purchaseCount: 3 })
    expect(h.kind).toBe('delta')
    if (h.kind === 'delta') expect(h.pct).toBeCloseTo(-10, 5)
  })

  it('flags the first purchase when bought only once', () => {
    expect(personalHistory({ lastPrice: 1.2, previousPrice: null, purchaseCount: 1 }).kind).toBe('first')
  })

  it('is not a first purchase when the product was bought before the window', () => {
    // Bought five times last year, once last week: the in-window count is 1, but claiming
    // "First purchase — we'll track this for you" would be a lie.
    expect(
      personalHistory({ lastPrice: 1.2, previousPrice: null, purchaseCount: 1, priorPurchaseExists: true }).kind,
    ).toBe('priceOnly')
  })

  it('returns priceOnly when there is no comparable previous scan despite ≥2 purchases', () => {
    // e.g. one regular scan among discounts — regular-preferred ranking leaves previousPrice null.
    expect(personalHistory({ lastPrice: 1.2, previousPrice: null, purchaseCount: 4 }).kind).toBe('priceOnly')
  })
})

// A TrendPoint's weekStart is always the UTC Monday that starts its week (that is what the
// backend emits), and the range bounds are Monday-snapped too — so the fixture must snap as
// well, or an arbitrary weekday sorts past `endWeek` and reads as out-of-range.
const weekStartDaysAgo = (days: number): string => mondayOf(new Date(Date.now() - days * 86_400_000))
const point = (weekStart: string, median: number | null = 1.5): TrendPoint => ({ weekStart, median, discountMedian: null })
const comparison = (over: Partial<TrendComparison> = {}): TrendComparison => ({
  countryCode: 'NL', regionCode: 'NL-NB', weeks: 26, currency: 'EUR', regionMerchantCount: 0,
  lines: [], ownHistory: [], diagnostics: [], ...over,
})
// resolveAutoMode only inspects array length, so opaque shims stand in for real lines.
const someLines = [{}] as unknown as TrendComparison['lines']
const someOwn = [{}] as unknown as TrendComparison['ownHistory']

describe('resolveAutoMode (fix 10)', () => {
  it('switches to own when the market view is empty but own history has data', () => {
    expect(resolveAutoMode(comparison({ lines: [], ownHistory: someOwn }), 'market')).toBe('own')
  })

  it('switches to market when own is empty but the market view has data', () => {
    expect(resolveAutoMode(comparison({ lines: someLines, ownHistory: [] }), 'own')).toBe('market')
  })

  it('stays put when the active mode already has data, or when neither does', () => {
    expect(resolveAutoMode(comparison({ lines: someLines, ownHistory: someOwn }), 'market')).toBeNull()
    expect(resolveAutoMode(comparison({ lines: [], ownHistory: [] }), 'own')).toBeNull()
    expect(resolveAutoMode(null, 'own')).toBeNull()
  })
})

describe('widenRangeIfHidden (fix 10)', () => {
  it('widens to 6m when all points fall outside the active preset but within the window', () => {
    expect(widenRangeIfHidden([[point(weekStartDaysAgo(60))]], '30d', '', '', false)).toBe('6m')
  })

  it('does not widen when a point is visible in the active preset', () => {
    expect(widenRangeIfHidden([[point(weekStartDaysAgo(2)), point(weekStartDaysAgo(60))]], '30d', '', '', false)).toBeNull()
  })

  it('does not widen when there are no real points', () => {
    expect(widenRangeIfHidden([[]], '30d', '', '', false)).toBeNull()
    expect(widenRangeIfHidden([[point(weekStartDaysAgo(60), null)]], '30d', '', '', false)).toBeNull()
  })

  it('never widens when already at 6m or on a custom range', () => {
    const pts = [[point(weekStartDaysAgo(60))]]
    expect(widenRangeIfHidden(pts, '6m', '', '', false)).toBeNull()
    expect(widenRangeIfHidden(pts, 'custom', '', '', false)).toBeNull()
  })
})
