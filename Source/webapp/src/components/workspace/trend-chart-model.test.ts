import { describe, it, expect } from 'vitest'
import { buildTrendChart, diagnosticNote, sizeChip, type CompareMode } from './trend-chart-model'
import { SERIES_COLORS } from './trend-data'
import type { TrendProduct } from './product-search'
import type { OwnPurchaseLine, TrendComparison, TrendLine, TrendPoint } from './use-price-trends'

// 2026-07-20 is a Monday, so every bound in these fixtures is already week-aligned and the
// assertions read as calendar weeks rather than off-by-one arithmetic.
const TODAY = new Date('2026-07-20T09:00:00Z')
const APR_6 = '2026-04-06'
const JUN_29 = '2026-06-29' // exactly 12 weeks after APR_6
const JAN_5 = '2026-01-05' // outside the 90d preset, inside the 26-week window

const MILK: TrendProduct = { id: 'p-milk', name: 'Halfvolle melk', brand: 'AH' }
const BREAD: TrendProduct = { id: 'p-bread', name: 'Volkoren brood', brand: null }

const noSize = { sizeText: null, sizeSource: null }

const point = (weekStart: string, median: number | null, discountMedian: number | null = null): TrendPoint =>
  ({ weekStart, median, discountMedian })

const own = (over: Partial<OwnPurchaseLine> = {}): OwnPurchaseLine => ({
  productId: MILK.id,
  points: [point(APR_6, 1.29)],
  purchaseCount: 1,
  lastPurchasedOn: '2026-04-08',
  priorPurchaseExists: false,
  lastPrice: 1.29,
  previousPrice: null,
  size: noSize,
  stale: false,
  staleDays: 4,
  ...over,
})

const market = (over: Partial<TrendLine> = {}): TrendLine => ({
  productId: MILK.id,
  merchantId: 'm-ah',
  merchantName: 'Albert Heijn',
  points: [point(APR_6, 1.35)],
  observationCount: 4,
  lastObservedOn: '2026-04-09',
  stale: false,
  staleDays: 3,
  size: noSize,
  ambiguous: false,
  ...over,
})

const comparison = (over: Partial<TrendComparison> = {}): TrendComparison => ({
  countryCode: 'NL',
  regionCode: 'NL-NB',
  weeks: 26,
  currency: 'EUR',
  regionMerchantCount: 0,
  lines: [],
  ownHistory: [],
  diagnostics: [],
  ...over,
})

const build = (
  over: Partial<TrendComparison>,
  products: TrendProduct[] = [MILK],
  mode: CompareMode = 'own',
  preset: Parameters<typeof buildTrendChart>[0]['preset'] = '6m',
) =>
  buildTrendChart({
    comparison: comparison(over),
    products,
    mode,
    preset,
    from: '',
    to: '',
    rangeInvalid: false,
    today: TODAY,
  })

describe('buildTrendChart — continuous week axis', () => {
  it('puts every empty week between two observations on the axis', () => {
    const model = build({ ownHistory: [own({ points: [point(APR_6, 1.29), point(JUN_29, 1.49)] })] })

    // 12 weeks apart → 13 axis weeks, not the 2 the old union-of-observed-weeks axis produced.
    expect(model.weeks).toHaveLength(13)
    expect(model.weeks[0]).toBe(APR_6)
    expect(model.weeks[12]).toBe(JUN_29)
    const [series] = model.series
    expect(series.data[0]).toBe(1.29)
    expect(series.data[12]).toBe(1.49)
    expect(series.data.filter((v) => v === null)).toHaveLength(11)
  })

  it('spans only the observed weeks, clamped to the range — not the whole 6-month preset', () => {
    const model = build({ ownHistory: [own({ points: [point(JUN_29, 1.49)] })] })
    expect(model.weeks).toEqual([JUN_29])
  })

  it('keeps a single observation as one labelled point', () => {
    const model = build({ ownHistory: [own()] })
    expect(model.labels).toEqual(['6 Apr'])
    expect(model.series).toHaveLength(1)
    expect(model.series[0].data).toEqual([1.29])
    expect(model.series[0].hasRegular).toBe(true)
  })
})

describe('buildTrendChart — promo-only series', () => {
  it('survives with a promo track when every purchase was discounted', () => {
    const model = build({ ownHistory: [own({ points: [point(APR_6, null, 0.99)] })] })

    expect(model.series).toHaveLength(1)
    expect(model.series[0].hasRegular).toBe(false)
    expect(model.series[0].hasPromo).toBe(true)
    expect(model.series[0].discounts).toEqual([0.99])
  })

  it('drops a series whose points carry neither a median nor a promo', () => {
    const model = build({ ownHistory: [own({ points: [point(APR_6, null, null)] })] })
    expect(model.series).toHaveLength(0)
  })
})

describe('buildTrendChart — hidden products', () => {
  it('reports OUT_OF_RANGE when the product has data the chosen range hides', () => {
    const model = build(
      { ownHistory: [own({ points: [point(JUN_29, 1.29)] }), own({ productId: BREAD.id, points: [point(JAN_5, 2.1)] })] },
      [MILK, BREAD],
      'own',
      '90d',
    )

    expect(model.series.map((s) => s.productId)).toEqual([MILK.id])
    expect(model.hidden).toEqual([{ productId: BREAD.id, reason: 'OUT_OF_RANGE' }])
  })

  it('reports NO_DATA when the active mode has nothing for the product', () => {
    const model = build({ ownHistory: [own()] }, [MILK, BREAD])
    expect(model.hidden).toEqual([{ productId: BREAD.id, reason: 'NO_DATA' }])
  })

  it('still explains every product when the range hides the whole chart', () => {
    const model = build({ ownHistory: [own({ points: [point(JAN_5, 1.29)] })] }, [MILK], 'own', '90d')
    expect(model.weeks).toEqual([])
    expect(model.hidden).toEqual([{ productId: MILK.id, reason: 'OUT_OF_RANGE' }])
  })

  it('returns an empty model with no accusations when there is no comparison yet', () => {
    const model = buildTrendChart({
      comparison: null,
      products: [MILK],
      mode: 'own',
      preset: '6m',
      from: '',
      to: '',
      rangeInvalid: false,
      today: TODAY,
    })
    expect(model.series).toEqual([])
    expect(model.hidden).toEqual([])
  })
})

describe('buildTrendChart — colour stability', () => {
  it('keeps a product on the same colour across the compare-mode toggle', () => {
    const ownModel = build({ ownHistory: [own()] }, [MILK], 'own')
    const marketModel = build({ lines: [market()] }, [MILK], 'market')
    expect(ownModel.series[0].color).toBe(SERIES_COLORS[0])
    expect(marketModel.series[0].color).toBe(SERIES_COLORS[0])
  })

  it('gives the second selected product its own colour block', () => {
    const model = build(
      { ownHistory: [own(), own({ productId: BREAD.id, points: [point(APR_6, 2.1)] })] },
      [MILK, BREAD],
    )
    expect(model.series.map((s) => s.color)).toEqual([SERIES_COLORS[0], SERIES_COLORS[3]])
  })

  it('walks a product’s colour block across its stores in market mode', () => {
    const model = build(
      { lines: [market(), market({ merchantId: 'm-jumbo', merchantName: 'Jumbo' })] },
      [MILK],
      'market',
    )
    expect(model.series.map((s) => s.color)).toEqual([SERIES_COLORS[0], SERIES_COLORS[1]])
  })
})

describe('buildTrendChart — size honesty (fix 09/01)', () => {
  const sized = (sizeText: string | null) => ({ sizeText, sizeSource: sizeText ? ('RECEIPT' as const) : null })

  it('warns only when two or more plotted series disagree or a size is unknown', () => {
    const one = build({ ownHistory: [own({ size: sized(null) })] })
    expect(one.sizeWarning).toBe(false) // a single series is always self-consistent

    const same = build(
      {
        lines: [market({ size: sized('2L') }), market({ merchantId: 'm-j', merchantName: 'Jumbo', size: sized('2L') })],
      },
      [MILK],
      'market',
    )
    expect(same.sizeWarning).toBe(false)

    const mixed = build(
      {
        lines: [market({ size: sized('2L') }), market({ merchantId: 'm-j', merchantName: 'Jumbo', size: sized('1L') })],
      },
      [MILK],
      'market',
    )
    expect(mixed.sizeWarning).toBe(true)
  })
})

describe('sizeChip', () => {
  it('describes the pack, never a per-unit price', () => {
    expect(sizeChip({ sizeText: null, sizeSource: null })).toBe('size not stated')
    expect(sizeChip({ sizeText: '2L', sizeSource: 'RECEIPT' })).toBe('2L')
    expect(sizeChip({ sizeText: '2L', sizeSource: 'USER' })).toBe('2L · set by you')
  })
})

describe('diagnosticNote', () => {
  const served = { productId: MILK.id, market: 'SERVED' as const, own: 'SERVED' as const }

  it('prefers the client-side range reason — the server cannot know the picked range', () => {
    expect(diagnosticNote(served, 'OUT_OF_RANGE', 'own')).toBe('outside this date range')
    expect(diagnosticNote(undefined, 'OUT_OF_RANGE', 'market')).toBe('outside this date range')
  })

  it('falls through to the backend reason for everything else', () => {
    expect(diagnosticNote({ ...served, own: 'NO_PURCHASES_IN_REGION' }, 'NO_DATA', 'own')).toBe('no purchases here yet')
    expect(diagnosticNote({ ...served, market: 'PREMIUM_REQUIRED' }, 'NO_DATA', 'market')).toBe('Premium unlocks market view')
    expect(
      diagnosticNote({ ...served, market: { kind: 'BELOW_QUORUM', merchantCount: 1, maxObservations: 2 } }, 'NO_DATA', 'market'),
    ).toBe('2 of 3 scans needed')
  })

  it('says nothing when the product is charting normally', () => {
    expect(diagnosticNote(served, undefined, 'own')).toBeNull()
    expect(diagnosticNote(served, undefined, 'market')).toBeNull()
    expect(diagnosticNote(undefined, undefined, 'own')).toBeNull()
  })
})
