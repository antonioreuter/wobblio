'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Calendar, Check, Clock, Crown, LineChart as LineChartIcon, Lock, Ruler, Table2, Trash2, TrendingUp, X } from 'lucide-react'
import { Card } from '@/components/ds'
import { formatDelta, formatViewMoney } from '@/lib/currency'
import {
  fetchProductLinks,
  FilterSelect,
  fmtDate,
  inRange,
  LineChart,
  MAX_PRODUCTS,
  MONTHS,
  personalHistory,
  PriceTrendsHelpButton,
  ProductSearch,
  RegionPicker,
  resolveAutoMode,
  SERIES_COLORS,
  setLinkSizeEquivalent,
  TREND_PRESETS,
  TrendSuggestions,
  TrendTable,
  usePriceTrends,
  widenRangeIfHidden,
  type LinkedPair,
  type MarketDiagnostic,
  type ProductDiagnostic,
  type TrendComparison,
  type TrendPreset,
  type TrendProduct,
  type SeriesSize,
} from '@/components/workspace'

interface ChartSeries {
  id: string
  productId: string
  name: string
  product: string
  merchant: string
  color: string
  data: (number | null)[]
  discounts: (number | null)[]
  stale: boolean
  staleDays: number
  own: boolean // the caller's own purchases — dashed line, "Your purchases" legend
  size: SeriesSize // descriptive pack size chip; prices are always the pack price paid (fix 09/01)
  ambiguous: boolean // 09/05: name may cover different SKUs at this store — shown as a warning
  // Own-mode only (§6.5.5 personal history); null/0 for market series.
  purchaseCount: number
  lastPurchasedOn: string | null
  lastPrice: number | null
  previousPrice: number | null
}

const OWN_LABEL = 'Your purchases'

// Comparison basis: the caller's own paid prices vs the crowdsourced local-market trend.
// Market is Premium-only — STANDARD is pinned to 'own'.
type CompareMode = 'own' | 'market'

// Descriptive size chip (fix 09/01). Prices are always the pack price paid — never per unit —
// so the chip only describes the pack: the receipt/annotated size ("2L", "2L · set by you") or
// "size not stated" when unknown. Never a €/unit label.
function sizeChip(size: SeriesSize): string {
  if (size.sizeText === null) return 'size not stated'
  return size.sizeSource === 'USER' ? `${size.sizeText} · set by you` : size.sizeText
}

export default function ReportsPage() {
  const { data: session } = useSession()
  const role = session?.user?.role
  // PREMIUM plus the elevated operator roles (ADMIN, TESTER); STANDARD sees the upsell.
  const isPremium = !!role && role !== 'STANDARD'

  const [mode, setMode] = useState<CompareMode>('own')
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const [selected, setSelected] = useState<TrendProduct[]>([])
  const [country, setCountry] = useState('')
  const [region, setRegion] = useState('')
  const [preset, setPreset] = useState<TrendPreset>('90d')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  // Default the region to the caller's profile (§6.5 serves their own region first);
  // the RegionPicker lets them switch it from there. Runs for every tier — the own-purchase
  // series is region-filtered too, so STANDARD needs the region resolved as well.
  useEffect(() => {
    fetch('/api/me/profile', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((p: { country?: string; regionCode?: string | null } | null) => {
        if (!p) return
        if (p.country) setCountry(p.country)
        if (p.regionCode) setRegion(p.regionCode)
      })
      .catch(() => undefined)
  }, [])

  const ids = selected.map((p) => p.id)
  // Every tier fetches: the backend serves the caller's own purchases to all, and gates the
  // public market trend to Premium (returns empty `lines` otherwise).
  const { comparison, loading } = usePriceTrends(ids, country, region, true)

  // Fix 10 auto-fallbacks: be opinionated so a selection never lands on a blank chart. The view is
  // "pinned" once the user picks a mode/range themselves (so we stop second-guessing them); the pin
  // resets when the selection changes so the next product gets a fresh best-fit view.
  const [viewPinned, setViewPinned] = useState(false)
  const [autoNotice, setAutoNotice] = useState<string | null>(null)
  const idsKey = ids.join(',')
  const pinView = () => setViewPinned(true)
  useEffect(() => {
    setViewPinned(false)
    setAutoNotice(null)
  }, [idsKey])

  // Fix 10 size-confirm: the caller's accepted links among the selected products. A plotted linked
  // pair whose sizes differ or aren't stated is watch-only until confirmed same-size here — the sole
  // override that makes it crown/optimizer eligible (09/05 comparability rule).
  const [links, setLinks] = useState<LinkedPair[]>([])
  const [sizeDismissed, setSizeDismissed] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (selected.length < 2) {
      setLinks([])
      return
    }
    const controller = new AbortController()
    fetchProductLinks(ids, controller.signal).then(setLinks).catch(() => undefined)
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])

  const confirmSameSize = async (aId: string, bId: string) => {
    await setLinkSizeEquivalent(aId, bId, true)
    setLinks(await fetchProductLinks(ids))
  }
  const dismissSizePrompt = (aId: string, bId: string) =>
    setSizeDismissed((s) => new Set(s).add(pairKey(aId, bId)))

  const atMax = selected.length >= MAX_PRODUCTS
  const add = (p: TrendProduct) => {
    if (!atMax && !selected.some((s) => s.id === p.id)) setSelected((s) => [...s, p])
  }
  const removeProduct = (id: string) => setSelected((s) => s.filter((p) => p.id !== id))
  const clear = () => {
    setSelected([])
    setPreset('90d')
    setFrom('')
    setTo('')
  }

  const rangeDays =
    from && to ? Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) : 0
  const rangeInvalid = preset === 'custom' && from !== '' && to !== '' && (rangeDays < 0 || rangeDays > 183)

  // One opinionated pass per data load (until the user pins the view): if the active mode is empty
  // but the other has data, switch to it; otherwise if the chosen range hides every point that does
  // exist in the 26-week window, widen to 6 months. setMode/setPreset re-run this until it settles.
  useEffect(() => {
    if (viewPinned || !comparison) return
    const target = resolveAutoMode(comparison, mode)
    if (target && target !== mode && (target !== 'market' || isPremium)) {
      setMode(target)
      setAutoNotice(
        target === 'own'
          ? 'Showing the prices you’ve paid — no local-market data here yet.'
          : 'Showing local-market prices.',
      )
      return
    }
    const sourceLines = mode === 'market' ? comparison.lines : comparison.ownHistory
    const widened = widenRangeIfHidden(sourceLines.map((l) => l.points), preset, from, to, rangeInvalid)
    if (widened && widened !== preset) {
      setPreset(widened)
      setAutoNotice('Widened to 6 months to show the available data.')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comparison, viewPinned, mode, preset, from, to, rangeInvalid, isPremium])

  const { series, labels, sizeWarning } = useMemo(
    () => buildChart(comparison, selected, mode, preset, from, to, rangeInvalid),
    [comparison, selected, mode, preset, from, to, rangeInvalid],
  )
  const rangeLabel = TREND_PRESETS.find(([v]) => v === preset)?.[1] ?? 'Last 3 months'

  return (
    <div className="pane">
      <div className="pane-head-row">
        <p className="pane-subtitle pane-subtitle--with-help">
          {isPremium
            ? `Compare an item across local stores over time — one line per store. Track up to ${MAX_PRODUCTS} products.`
            : `Track your own purchase prices over time. Upgrade to Premium to compare against local stores.`}
          <PriceTrendsHelpButton />
        </p>
        <RegionPicker
          countryCode={country}
          regionCode={region}
          onChange={(c, r) => { setCountry(c); setRegion(r) }}
        />
      </div>

      {!isPremium && (
        <Card className="panel budget-upsell" data-testid="trends-upsell">
          <div className="budget-upsell-icon"><Crown size={22} /></div>
          <h3 className="budget-upsell-title">Compare against local stores with Premium</h3>
          <p className="budget-upsell-body">
            You can already chart the prices you’ve paid. Premium adds the crowdsourced price index:
            compare up to {MAX_PRODUCTS} products across local stores over six months, with weekly
            medians, promo markers, and regional price trends.
          </p>
        </Card>
      )}

      <Card className="panel filter-card">
        <div className="filter-head">
          <TrendingUp size={15} /> <span>Filter price trends</span>
        </div>

        <div className="filter-grid">
          <div className="span-2">
            <ProductSearch
              onAdd={add}
              disabled={atMax}
              exclude={ids}
              mode={mode}
              countryCode={country}
              regionCode={region}
            />
          </div>
          <FilterSelect
            label="Date range"
            icon={<Calendar size={15} />}
            value={preset}
            onChange={(e) => { pinView(); setPreset(e.target.value as TrendPreset) }}
          >
            {TREND_PRESETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </FilterSelect>
        </div>

        {preset === 'custom' && (
          <div className="filter-grid filter-dates">
            <div className="filter-field">
              <label className="filter-label">From</label>
              <div className="filter-wrap">
                <span className="lead-icon"><Calendar size={15} /></span>
                <input
                  type="date"
                  className="filter-select"
                  value={from}
                  max={to || undefined}
                  onChange={(e) => { pinView(); setFrom(e.target.value) }}
                />
              </div>
            </div>
            <div className="filter-field">
              <label className="filter-label">To</label>
              <div className="filter-wrap">
                <span className="lead-icon"><Calendar size={15} /></span>
                <input
                  type="date"
                  className="filter-select"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => { pinView(); setTo(e.target.value) }}
                />
              </div>
            </div>
          </div>
        )}

        <div className="filter-sep" />

        <div className="filter-field">
          <label className="filter-label">
            Selected products ({selected.length}/{MAX_PRODUCTS})
          </label>
          <div className="trend-picker">
            {selected.length === 0 && (
              <span className="trend-empty-hint">Search above to add up to {MAX_PRODUCTS} products.</span>
            )}
            {selected.map((p) => {
              const note = diagnosticNote(comparison?.diagnostics?.find((d) => d.productId === p.id), mode)
              return (
                <span className="trend-chip" key={p.id}>
                  {p.name}
                  {note && (
                    <span className="legend-unit" title="Why this isn’t charting" data-testid="trend-chip-note">
                      {note}
                    </span>
                  )}
                  <button
                    type="button"
                    className="trend-x"
                    aria-label={`Remove ${p.name}`}
                    onClick={() => removeProduct(p.id)}
                  >
                    ✕
                  </button>
                </span>
              )
            })}
          </div>
          <TrendSuggestions
            selectedIds={ids}
            countryCode={country}
            regionCode={region}
            atMax={atMax}
            onAdd={add}
          />
        </div>

        <div className="filter-foot">
          <span className={`filter-hint ${rangeInvalid ? 'invalid' : ''}`}>
            <Clock size={13} />
            {rangeInvalid ? 'Range can’t exceed 6 months.' : `${series.length} lines · max range 6 months`}
          </span>
          <div className="filter-actions">
            <button
              type="button"
              className="btn btn--text"
              style={{ padding: '8px 14px' }}
              onClick={clear}
            >
              <Trash2 size={14} /> Clear filters
            </button>
          </div>
        </div>
      </Card>

      <Card className="panel">
        <div className="panel-header" style={{ marginBottom: 8 }}>
          <span className="panel-title">Price paid per item</span>
          <div className="trend-mode-row">
            <div className="trend-mode-toggle" role="group" aria-label="Comparison basis">
              <button
                type="button"
                className={`trend-mode-btn ${mode === 'own' ? 'is-active' : ''}`}
                aria-pressed={mode === 'own'}
                onClick={() => { pinView(); setMode('own') }}
                data-testid="trends-mode-own"
              >
                My prices
              </button>
              <button
                type="button"
                className={`trend-mode-btn ${mode === 'market' ? 'is-active' : ''}`}
                aria-pressed={mode === 'market'}
                // Market is Premium-only; STANDARD stays on 'own' and the locked option
                // points back at the always-visible upsell card above.
                disabled={!isPremium}
                title={isPremium ? undefined : 'Premium — compare against local stores'}
                onClick={() => { if (isPremium) { pinView(); setMode('market') } }}
                data-testid="trends-mode-market"
              >
                {!isPremium && <Lock size={11} />} Local market
              </button>
            </div>
            <div className="trend-mode-toggle" role="group" aria-label="Chart or table view">
              <button
                type="button"
                className={`trend-mode-btn ${view === 'chart' ? 'is-active' : ''}`}
                aria-pressed={view === 'chart'}
                onClick={() => setView('chart')}
                data-testid="trends-view-chart"
              >
                <LineChartIcon size={12} /> Chart
              </button>
              <button
                type="button"
                className={`trend-mode-btn ${view === 'table' ? 'is-active' : ''}`}
                aria-pressed={view === 'table'}
                onClick={() => setView('table')}
                data-testid="trends-view-table"
              >
                <Table2 size={12} /> Table
              </button>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {rangeInvalid ? 'Last 3 months' : rangeLabel}
            </span>
          </div>
        </div>
        {autoNotice && (
          <div className="trend-unit-caveat" data-testid="trends-auto-notice" role="status">
            <Clock size={13} />
            <span>{autoNotice}</span>
            <button
              type="button"
              className="trend-x"
              style={{ marginLeft: 'auto' }}
              aria-label="Dismiss notice"
              onClick={() => setAutoNotice(null)}
            >
              ✕
            </button>
          </div>
        )}
        <TrendChartBody
          loading={loading}
          hasProducts={selected.length > 0}
          comparison={comparison}
          mode={mode}
          view={view}
          series={series}
          labels={labels}
          sizeWarning={sizeWarning}
          links={links}
          sizeDismissed={sizeDismissed}
          onConfirmSize={confirmSameSize}
          onDismissSize={dismissSizePrompt}
        />
      </Card>
    </div>
  )
}

// Canonical key for an unordered product pair (matches the backend's a<b storage), used to track
// locally-dismissed size prompts.
const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`)

interface SizePrompt {
  aId: string
  bId: string
  aLabel: string
  bLabel: string
}

// Fix 10 — for each accepted link whose BOTH products are plotted, isn't already size-confirmed, and
// whose sizes aren't known-equal, surface a one-tap "same size?" that promotes the pair to
// crown/optimizer eligibility. Known-equal sizes are already comparable, so they get no prompt.
function buildSizePrompts(series: ChartSeries[], links: LinkedPair[], dismissed: Set<string>): SizePrompt[] {
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

// Fix 10 — a short, honest note on a selected-product chip when it isn't charting in the active
// mode, so an empty line reads as a specific reason instead of a mysterious gap.
function diagnosticNote(d: ProductDiagnostic | undefined, mode: CompareMode): string | null {
  if (!d) return null
  if (mode === 'own') return d.own === 'NO_PURCHASES_IN_REGION' ? 'no purchases here yet' : null
  return marketDiagnosticNote(d.market)
}

function marketDiagnosticNote(market: MarketDiagnostic): string | null {
  if (market === 'SERVED') return null
  if (market === 'PREMIUM_REQUIRED') return 'Premium unlocks market view'
  if (market === 'NO_OBSERVATIONS_IN_REGION') return 'no local prices in this region'
  if (market === 'OUT_OF_WINDOW') return 'older than 6 months'
  if (market === 'CURRENCY_MISMATCH') return 'prices in another currency'
  return `${market.maxObservations} of 3 scans needed`
}

function TrendChartBody({
  loading,
  hasProducts,
  comparison,
  mode,
  view,
  series,
  labels,
  sizeWarning,
  links,
  sizeDismissed,
  onConfirmSize,
  onDismissSize,
}: {
  loading: boolean
  hasProducts: boolean
  comparison: TrendComparison | null
  mode: CompareMode
  view: 'chart' | 'table'
  series: ChartSeries[]
  labels: string[]
  sizeWarning: boolean
  links: LinkedPair[]
  sizeDismissed: Set<string>
  onConfirmSize: (aId: string, bId: string) => void
  onDismissSize: (aId: string, bId: string) => void
}) {
  if (!hasProducts) {
    return (
      <div className="table-empty">
        <TrendingUp size={26} />
        <span>Add a product above to start comparing prices across stores.</span>
      </div>
    )
  }
  if (loading && !comparison) {
    return <div className="table-empty"><span>Loading price trends…</span></div>
  }
  // No series at all (no own purchases here yet and no market cell cleared k≥3), or the
  // chosen range hides every point.
  if (series.length === 0) {
    // The active mode has no source rows at all (vs. a range that hides all points).
    const sourceEmpty =
      !comparison ||
      (mode === 'market' ? comparison.lines.length === 0 : comparison.ownHistory.length === 0)
    // Market mode with stores tracked but none past the k≥3 gate → the live "you're close" nudge
    // (§6.5.5). `lines` empty while `regionMerchantCount > 0` is exactly the sub-quorum case.
    const stores = comparison?.regionMerchantCount ?? 0
    const emptyCopy = !sourceEmpty
      ? 'No price points in this date range — widen the range to see more.'
      : mode === 'market'
        ? stores > 0
          ? `${stores} store${stores === 1 ? '' : 's'} tracked in your area — scan more receipts to unlock comparisons.`
          : 'No local-store prices yet — every scan makes it smarter.'
        : 'No prices yet — once you’ve scanned one of these items in this region it’ll chart here. Every scan makes it smarter.'
    return (
      <div className="table-empty" data-testid="trends-empty">
        <TrendingUp size={26} />
        <span>{emptyCopy}</span>
      </div>
    )
  }

  // View currency (§6.5 honesty) — the whole comparison is single-currency.
  const currency = comparison?.currency ?? null

  // Size-confirm prompts only make sense against the plotted market series (crown/optimizer inputs).
  const sizePrompts = mode === 'market' ? buildSizePrompts(series, links, sizeDismissed) : []

  return (
    <>
      {sizeWarning && (
        <div className="trend-unit-caveat" data-testid="trends-size-note" role="note">
          <Clock size={13} />
          <span>
            Sizes differ or aren’t stated — you’re comparing prices <strong>as paid</strong>, not per unit.
          </span>
        </div>
      )}
      {sizePrompts.map((p) => (
        <div key={`size-${p.aId}-${p.bId}`} className="trend-unit-caveat" data-testid="trend-size-confirm" role="note">
          <Ruler size={13} />
          <span>
            Same size? <strong>{p.aLabel}</strong> vs <strong>{p.bLabel}</strong> — confirm to rank them as best price.
          </span>
          <button
            type="button"
            className="btn btn--text"
            style={{ marginLeft: 'auto' }}
            onClick={() => onConfirmSize(p.aId, p.bId)}
            data-testid="trend-size-confirm-yes"
            aria-label="Confirm same size"
          >
            <Check size={13} /> Same size
          </button>
          <button
            type="button"
            className="trend-x"
            onClick={() => onDismissSize(p.aId, p.bId)}
            aria-label="Dismiss size prompt"
          >
            <X size={12} />
          </button>
        </div>
      ))}
      {series.filter((s) => s.ambiguous).map((s) => (
        <div key={`amb-${s.id}`} className="trend-unit-caveat" data-testid="trends-ambiguity-banner" role="note">
          <Clock size={13} />
          <span>
            <strong>{s.product} · {s.merchant}</strong> — this name may cover different products at this
            store, so its prices vary widely. It isn’t crowned as a best price.
          </span>
        </div>
      ))}
      {view === 'table' ? (
        <TrendTable series={series} labels={labels} currency={currency} />
      ) : (
        <LineChart series={series} months={labels} currency={currency} />
      )}
      <div className="trend-legend">
        {series.map((s) => (
          <LegendItem key={s.id} s={s} mode={mode} currency={currency} />
        ))}
      </div>
    </>
  )
}

// One legend row. Market mode shows the median with an explicit "over range" delta; own mode
// (§6.5.5) shows the last paid price with "▲/▼ N% vs previous scan", or the first-purchase copy —
// always glyph + text label, never colour alone (accessibility).
function LegendItem({
  s,
  mode,
  currency,
}: {
  s: ChartSeries
  mode: CompareMode
  currency: string | null
}) {
  const money = (v: number | null) => (v !== null ? formatViewMoney(v, currency) : '—')
  const vals = s.data.filter((v): v is number => v !== null)
  const rangeMedian = vals.length ? vals[vals.length - 1] : null
  // Guard vals[0] === 0 → a 0.00 first median would make the delta Infinity/NaN.
  const rangeDelta =
    vals.length > 1 && vals[0] !== 0 ? ((vals[vals.length - 1] - vals[0]) / vals[0]) * 100 : null
  const own = mode === 'own'
  const history = own ? personalHistory(s) : null
  const headline = own ? s.lastPrice ?? rangeMedian : rangeMedian

  return (
    <div className="legend-item">
      <span className="dot" style={{ background: s.color, opacity: s.stale ? 0.5 : 1 }} />
      <div className="legend-meta">
        <span className="legend-name">
          {s.product} · <strong>{s.merchant}</strong>
          <span className="legend-unit" title={s.size.sizeText ? 'pack size' : 'size not stated'}>
            {sizeChip(s.size)}
          </span>
          {s.stale && (
            <span className="legend-stale" title={`No data for ${s.staleDays} days`}>
              <Clock size={11} /> stale · {s.staleDays}d
            </span>
          )}
          {own && s.lastPurchasedOn && (
            <span className="legend-stale" title="Your most recent purchase">
              <Clock size={11} /> last bought {fmtDate(s.lastPurchasedOn)}
            </span>
          )}
        </span>
        <span className="legend-now">
          {own && <span className="legend-lastpaid">last paid</span>} {money(headline)}
          {own && history?.kind === 'first' && (
            <span className="legend-first">First purchase — we’ll track this for you</span>
          )}
          {own && history?.kind === 'delta' && (
            <span className="legend-delta" style={{ color: history.pct > 0 ? 'var(--danger)' : 'var(--success)' }}>
              {formatDelta(history.pct)} vs previous scan
            </span>
          )}
          {!own && rangeDelta !== null && (
            <span className="legend-delta" style={{ color: rangeDelta > 0 ? 'var(--danger)' : 'var(--success)' }}>
              {formatDelta(rangeDelta)} over range
            </span>
          )}
        </span>
      </div>
    </div>
  )
}

// Aligns every served line onto a shared week axis (union of observed weeks, filtered
// by the active preset) so the chart breaks on missing weeks instead of interpolating.
function buildChart(
  comparison: TrendComparison | null,
  products: TrendProduct[],
  mode: CompareMode,
  preset: TrendPreset,
  from: string,
  to: string,
  rangeInvalid: boolean,
): { series: ChartSeries[]; labels: string[]; sizeWarning: boolean } {
  // Only the active mode's source feeds the chart — own purchases or the market trend, never both.
  const sourceLines = mode === 'market' ? comparison?.lines ?? [] : comparison?.ownHistory ?? []
  if (!comparison || sourceLines.length === 0) {
    return { series: [], labels: [], sizeWarning: false }
  }

  const nameById = new Map(products.map((p) => [p.id, p.name]))
  const weekSet = new Set<string>()
  sourceLines.forEach((l) => l.points.forEach((pt) => weekSet.add(pt.weekStart)))
  const weeks = [...weekSet]
    .sort()
    .filter((w) => inRange(new Date(`${w}T00:00:00Z`), preset, from, to, rangeInvalid))

  const labels = weeks.map((w) => {
    const d = new Date(`${w}T00:00:00Z`)
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
  })

  // Own vs market are never blended, so the comparison stays honest (§6.5.2). Market emits
  // one solid line per store; own emits one dashed line per product.
  const modeSeries: ChartSeries[] =
    mode === 'market'
      ? comparison.lines.map((l, i) => {
          const median = new Map(l.points.map((pt) => [pt.weekStart, pt.median]))
          const discount = new Map(l.points.map((pt) => [pt.weekStart, pt.discountMedian]))
          const product = nameById.get(l.productId) ?? l.productId
          return {
            id: `${l.productId}|${l.merchantId}`,
            productId: l.productId,
            product,
            merchant: l.merchantName,
            name: `${product} · ${l.merchantName}`,
            color: SERIES_COLORS[i % SERIES_COLORS.length],
            data: weeks.map((w) => median.get(w) ?? null),
            discounts: weeks.map((w) => discount.get(w) ?? null),
            stale: l.stale,
            staleDays: l.staleDays,
            own: false,
            size: l.size,
            ambiguous: l.ambiguous,
            purchaseCount: 0,
            lastPurchasedOn: null,
            lastPrice: null,
            previousPrice: null,
          }
        })
      : comparison.ownHistory.map((l, i) => {
          const median = new Map(l.points.map((pt) => [pt.weekStart, pt.median]))
          const discount = new Map(l.points.map((pt) => [pt.weekStart, pt.discountMedian]))
          const product = nameById.get(l.productId) ?? l.productId
          return {
            id: `own|${l.productId}`,
            productId: l.productId,
            product,
            merchant: OWN_LABEL,
            name: `${product} · ${OWN_LABEL}`,
            color: SERIES_COLORS[i % SERIES_COLORS.length],
            data: weeks.map((w) => median.get(w) ?? null),
            discounts: weeks.map((w) => discount.get(w) ?? null),
            stale: false,
            staleDays: 0,
            own: true,
            size: l.size,
            ambiguous: false,
            purchaseCount: l.purchaseCount,
            lastPurchasedOn: l.lastPurchasedOn,
            lastPrice: l.lastPrice,
            previousPrice: l.previousPrice,
          }
        })

  // A line with no points in the visible range adds only noise to the legend.
  const visible = modeSeries.filter(
    (s) => s.data.some((v) => v !== null) || s.discounts.some((v) => v !== null),
  )
  // Honesty guard (fix 09/01): note when a plotted comparison mixes differing or unknown sizes —
  // prices are shown as paid, never per unit. A single series is always self-consistent.
  const sizeTexts = new Set(visible.map((s) => s.size.sizeText))
  const sizeWarning = visible.length > 1 && (sizeTexts.has(null) || sizeTexts.size > 1)
  return { series: visible, labels, sizeWarning }
}
