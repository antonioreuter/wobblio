// Presentation model for the §6.5.1 price-trends chart. Everything here is pure so the axis maths,
// the visibility rules and the per-product explanations are unit-testable without a DOM — the
// reports page is composition and state only.

import { MONTHS } from './invoice-data'
import type { LinkedPair } from './product-links-data'
import type { TrendProduct } from './product-search'
import {
  buildWeekAxis,
  resolveWeekRange,
  seriesColor,
  weekInRange,
  type TrendPreset,
  type WeekRange,
} from './trend-data'
import type {
  MarketDiagnostic,
  OwnPurchaseLine,
  ProductDiagnostic,
  SeriesSize,
  TrendComparison,
  TrendLine,
  TrendPoint,
} from './use-price-trends'

// Comparison basis: the caller's own paid prices vs the crowdsourced local-market trend.
// Market is Premium-only — STANDARD is pinned to 'own'.
export type CompareMode = 'own' | 'market'

export const OWN_LABEL = 'Your purchases'

export interface ChartSeries {
  id: string
  productId: string
  name: string
  product: string
  merchant: string
  color: string
  data: (number | null)[] // weekly regular median, aligned to `weeks`
  discounts: (number | null)[] // weekly discounted median, aligned to `weeks`
  hasRegular: boolean // any regular median in range — false for a promo-only series
  hasPromo: boolean // any discounted median in range
  stale: boolean
  staleDays: number
  own: boolean // the caller's own purchases — dashed line, "Your purchases" legend
  size: SeriesSize // descriptive pack size chip; prices are always the pack price paid (fix 09/01)
  ambiguous: boolean // 09/05: name may cover different SKUs at this store — shown as a warning
  // Own-mode only (§6.5.5 personal history); null/0/false for market series.
  purchaseCount: number
  priorPurchaseExists: boolean
  lastPurchasedOn: string | null
  lastPrice: number | null
  previousPrice: number | null
}

// Why a selected product isn't on the chart for a reason the SERVER can't know: the range the user
// picked hides it, or the active mode has nothing for it at all.
export type HiddenReason = 'OUT_OF_RANGE' | 'NO_DATA'

export interface TrendChartModel {
  series: ChartSeries[]
  labels: string[] // one per axis week, e.g. "5 Jan"
  weeks: string[] // the continuous ISO-Monday axis
  sizeWarning: boolean
  hidden: Array<{ productId: string; reason: HiddenReason }>
}

const EMPTY_MODEL: TrendChartModel = { series: [], labels: [], weeks: [], sizeWarning: false, hidden: [] }

export interface TrendChartInput {
  comparison: TrendComparison | null
  products: TrendProduct[]
  mode: CompareMode
  preset: TrendPreset
  from: string
  to: string
  rangeInvalid: boolean
  today?: Date
}

// Aligns every served line onto ONE continuous week axis so the chart spaces observations by real
// time and breaks on weeks nobody observed. The axis spans the first→last observed week within the
// selected range (not the whole range) — that keeps true relative spacing without a wall of dead
// space when a 6-month preset holds three recent purchases.
export function buildTrendChart(input: TrendChartInput): TrendChartModel {
  const { comparison, products, mode } = input
  if (!comparison) return EMPTY_MODEL

  // Own vs market are never blended, so the comparison stays honest (§6.5.2). Market emits one
  // line per store; own emits one line per product.
  const sourceLines = mode === 'market' ? comparison.lines : comparison.ownHistory
  const range = resolveWeekRange(input.preset, input.from, input.to, input.rangeInvalid, input.today)
  const weeks = axisWeeks(sourceLines, range)
  if (weeks.length === 0) {
    return { ...EMPTY_MODEL, hidden: hiddenProducts(products, sourceLines, []) }
  }

  const built =
    mode === 'market'
      ? comparison.lines.map((line) => marketSeries(line, weeks, products, comparison.lines))
      : comparison.ownHistory.map((line) => ownSeries(line, weeks, products))

  // A line with no points in the visible range adds only noise to the legend.
  const series = built.filter((s) => s.hasRegular || s.hasPromo)
  return {
    series,
    weeks,
    labels: weeks.map(weekLabel),
    sizeWarning: mixedSizes(series),
    hidden: hiddenProducts(products, sourceLines, series),
  }
}

type SourceLine = TrendLine | OwnPurchaseLine

// The continuous span of weeks to render: every Monday between the first and last week that
// actually carries a value inside the range.
function axisWeeks(lines: SourceLine[], range: WeekRange): string[] {
  const observed = lines
    .flatMap((l) => l.points)
    .filter((pt) => hasValue(pt) && weekInRange(pt.weekStart, range))
    .map((pt) => pt.weekStart)
    .sort()
  if (observed.length === 0) return []
  return buildWeekAxis(observed[0], observed[observed.length - 1])
}

const hasValue = (pt: TrendPoint): boolean => pt.median !== null || pt.discountMedian !== null

function weekLabel(weekStart: string): string {
  const d = new Date(`${weekStart}T00:00:00Z`)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}

function marketSeries(
  line: TrendLine,
  weeks: string[],
  products: TrendProduct[],
  allLines: TrendLine[],
): ChartSeries {
  const product = productName(line.productId, products)
  const merchantOrdinal = allLines.filter((l) => l.productId === line.productId).indexOf(line)
  return {
    ...alignPoints(line.points, weeks),
    id: `${line.productId}|${line.merchantId}`,
    productId: line.productId,
    product,
    merchant: line.merchantName,
    name: `${product} · ${line.merchantName}`,
    color: seriesColor(colorSlot(line.productId, products) + merchantOrdinal),
    stale: line.stale,
    staleDays: line.staleDays,
    own: false,
    size: line.size,
    ambiguous: line.ambiguous,
    purchaseCount: 0,
    priorPurchaseExists: false,
    lastPurchasedOn: null,
    lastPrice: null,
    previousPrice: null,
  }
}

function ownSeries(line: OwnPurchaseLine, weeks: string[], products: TrendProduct[]): ChartSeries {
  const product = productName(line.productId, products)
  return {
    ...alignPoints(line.points, weeks),
    id: `own|${line.productId}`,
    productId: line.productId,
    product,
    merchant: OWN_LABEL,
    name: `${product} · ${OWN_LABEL}`,
    color: seriesColor(colorSlot(line.productId, products)),
    stale: line.stale,
    staleDays: line.staleDays,
    own: true,
    size: line.size,
    ambiguous: false,
    purchaseCount: line.purchaseCount,
    priorPurchaseExists: line.priorPurchaseExists,
    lastPurchasedOn: line.lastPurchasedOn,
    lastPrice: line.lastPrice,
    previousPrice: line.previousPrice,
  }
}

function alignPoints(
  points: TrendPoint[],
  weeks: string[],
): Pick<ChartSeries, 'data' | 'discounts' | 'hasRegular' | 'hasPromo'> {
  const median = new Map(points.map((pt) => [pt.weekStart, pt.median]))
  const discount = new Map(points.map((pt) => [pt.weekStart, pt.discountMedian]))
  const data = weeks.map((w) => median.get(w) ?? null)
  const discounts = weeks.map((w) => discount.get(w) ?? null)
  return {
    data,
    discounts,
    hasRegular: data.some((v) => v !== null),
    hasPromo: discounts.some((v) => v !== null),
  }
}

const productName = (productId: string, products: TrendProduct[]): string =>
  products.find((p) => p.id === productId)?.name ?? productId

// Colour follows the product's place in the SELECTION, never the per-mode series index, so a
// product keeps its hue when the compare mode is toggled. Three slots per product (MAX_PRODUCTS = 3
// against a 9-colour palette) leave room for a product's first stores; beyond that the palette
// wraps and the legend name remains the discriminator.
const colorSlot = (productId: string, products: TrendProduct[]): number =>
  Math.max(0, products.findIndex((p) => p.id === productId)) * 3

// Honesty guard (fix 09/01): note when a plotted comparison mixes differing or unknown sizes —
// prices are shown as paid, never per unit. A single series is always self-consistent.
function mixedSizes(series: ChartSeries[]): boolean {
  if (series.length < 2) return false
  const sizes = new Set(series.map((s) => s.size.sizeText))
  return sizes.has(null) || sizes.size > 1
}

// A selected product that produced no visible series: say whether its data is merely outside the
// chosen range, or absent from this mode altogether (the backend diagnostic explains the latter).
function hiddenProducts(
  products: TrendProduct[],
  sourceLines: SourceLine[],
  series: ChartSeries[],
): Array<{ productId: string; reason: HiddenReason }> {
  const plotted = new Set(series.map((s) => s.productId))
  return products
    .filter((p) => !plotted.has(p.id))
    .map((p) => ({
      productId: p.id,
      reason: sourceLines.some((l) => l.productId === p.id && l.points.some(hasValue))
        ? ('OUT_OF_RANGE' as const)
        : ('NO_DATA' as const),
    }))
}

// Descriptive size chip (fix 09/01). Prices are always the pack price paid — never per unit — so the
// chip only describes the pack: the receipt/annotated size ("2L", "2L · set by you") or "size not
// stated" when unknown. Never a €/unit label.
export function sizeChip(size: SeriesSize): string {
  if (size.sizeText === null) return 'size not stated'
  return size.sizeSource === 'USER' ? `${size.sizeText} · set by you` : size.sizeText
}

// A short, honest note on a selected-product chip when it isn't charting, so an empty line reads as
// a specific reason instead of a mysterious gap. The client-side range reason wins when it applies —
// the server can't know which range the user picked.
export function diagnosticNote(
  diagnostic: ProductDiagnostic | undefined,
  hidden: HiddenReason | undefined,
  mode: CompareMode,
): string | null {
  if (hidden === 'OUT_OF_RANGE') return 'outside this date range'
  if (!diagnostic) return null
  if (mode === 'own') return diagnostic.own === 'NO_PURCHASES_IN_REGION' ? 'no purchases here yet' : null
  return marketDiagnosticNote(diagnostic.market)
}

export function marketDiagnosticNote(market: MarketDiagnostic): string | null {
  if (market === 'SERVED') return null
  if (market === 'PREMIUM_REQUIRED') return 'Premium unlocks market view'
  if (market === 'NO_OBSERVATIONS_IN_REGION') return 'no local prices in this region'
  if (market === 'OUT_OF_WINDOW') return 'older than 6 months'
  if (market === 'CURRENCY_MISMATCH') return 'prices in another currency'
  return `${market.maxObservations} of 3 scans needed`
}

// Canonical key for an unordered product pair (matches the backend's a<b storage), used to track
// locally-dismissed size prompts.
export const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`)

export interface SizePrompt {
  aId: string
  bId: string
  aLabel: string
  bLabel: string
}

// Fix 10 — for each accepted link whose BOTH products are plotted, isn't already size-confirmed, and
// whose sizes aren't known-equal, surface a one-tap "same size?" that promotes the pair to
// crown/optimizer eligibility. Known-equal sizes are already comparable, so they get no prompt.
export function buildSizePrompts(
  series: ChartSeries[],
  links: LinkedPair[],
  dismissed: Set<string>,
): SizePrompt[] {
  const byProduct = new Map(series.map((s) => [s.productId, s]))
  const prompts: SizePrompt[] = []
  for (const link of links) {
    if (link.sizeEquivalent) continue
    if (dismissed.has(pairKey(link.productAId, link.productBId))) continue
    const a = byProduct.get(link.productAId)
    const b = byProduct.get(link.productBId)
    if (!a || !b) continue // only prompt when both sides are actually plotted
    if (a.size.sizeText !== null && b.size.sizeText !== null && a.size.sizeText === b.size.sizeText) continue
    prompts.push({
      aId: link.productAId,
      bId: link.productBId,
      aLabel: `${a.product} · ${a.merchant}`,
      bLabel: `${b.product} · ${b.merchant}`,
    })
  }
  return prompts
}
