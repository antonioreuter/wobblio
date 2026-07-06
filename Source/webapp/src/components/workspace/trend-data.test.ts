import { describe, it, expect, vi, afterEach } from 'vitest'
import { inRange, personalHistory, TREND_PRESETS } from './trend-data'

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

describe('inRange', () => {
  it('excludes a 150-day-old week under 90d but includes it under 6m', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-05T12:00:00Z'))
    const old = week(150)
    expect(inRange(old, '90d', '', '', false)).toBe(false)
    expect(inRange(old, '6m', '', '', false)).toBe(true)
  })

  it('includes the full 6-month window but excludes beyond it', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-05T12:00:00Z'))
    expect(inRange(week(180), '6m', '', '', false)).toBe(true)
    expect(inRange(week(200), '6m', '', '', false)).toBe(false)
  })

  it('month preset keeps only current-UTC-month weeks', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-20T12:00:00Z'))
    expect(inRange(new Date('2026-07-06T00:00:00Z'), 'month', '', '', false)).toBe(true)
    expect(inRange(new Date('2026-06-29T00:00:00Z'), 'month', '', '', false)).toBe(false)
  })

  it('month preset is stable across a month boundary in a non-UTC-aligned instant', () => {
    // Just after UTC midnight on the 1st: a local-time (getMonth) comparison would still
    // read the previous month in negative-offset zones and wrongly drop the new-month week.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01T00:30:00Z'))
    expect(inRange(new Date('2026-08-01T00:00:00Z'), 'month', '', '', false)).toBe(true)
    expect(inRange(new Date('2026-07-27T00:00:00Z'), 'month', '', '', false)).toBe(false)
  })

  it('honours a valid custom range and ignores an invalid one (falls back to 90d)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-05T12:00:00Z'))
    const d = new Date('2026-05-10T00:00:00Z')
    expect(inRange(d, 'custom', '2026-05-01', '2026-05-31', false)).toBe(true)
    expect(inRange(d, 'custom', '2026-06-01', '2026-06-30', false)).toBe(false)
    // rangeInvalid → the custom branch is skipped and the default 90d window applies.
    expect(inRange(week(150), 'custom', '2026-01-01', '2026-12-31', true)).toBe(false)
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

  it('returns priceOnly when there is no comparable previous scan despite ≥2 purchases', () => {
    // e.g. one regular scan among discounts — regular-preferred ranking leaves previousPrice null.
    expect(personalHistory({ lastPrice: 1.2, previousPrice: null, purchaseCount: 4 }).kind).toBe('priceOnly')
  })
})
