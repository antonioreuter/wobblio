'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Calendar, Clock, Crown, Lock, Trash2, TrendingUp } from 'lucide-react'
import { Card } from '@/components/ds'
import {
  FilterSelect,
  LineChart,
  MAX_PRODUCTS,
  MONTHS,
  PriceTrendsHelpButton,
  ProductSearch,
  RegionPicker,
  SERIES_COLORS,
  usePriceTrends,
  type Preset,
  type TrendComparison,
  type TrendProduct,
  type TrendUnit,
} from '@/components/workspace'

// Reports-local presets. The shared `Preset`/`PRESETS` are also driven by the invoices
// filter (spend filtering) — the price-trends report is the only surface that needs the
// 6-month window (the backend serves 26 weeks), so we widen here, not the shared type.
type TrendPreset = Preset | '6m'
const TREND_PRESETS: Array<[TrendPreset, string]> = [
  ['30d', 'Last 30 days'],
  ['month', 'This month'],
  ['90d', 'Last 3 months'],
  ['6m', 'Last 6 months'],
  ['custom', 'Custom range'],
]

interface ChartSeries {
  id: string
  name: string
  product: string
  merchant: string
  color: string
  data: (number | null)[]
  discounts: (number | null)[]
  stale: boolean
  staleDays: number
  own: boolean // the caller's own purchases — dashed line, "Your purchases" legend
  unit: TrendUnit // null = per item (size unknown); else €/unit and cross-comparable
}

const OWN_LABEL = 'Your purchases'

// Comparison basis: the caller's own paid prices vs the crowdsourced local-market trend.
// Market is Premium-only — STANDARD is pinned to 'own'.
type CompareMode = 'own' | 'market'

// Honest price-unit label. A known pack size makes the value a comparable €/unit; an unknown
// size means the value is per item (per pack) and must not be compared across stores.
function unitLabel(unit: TrendUnit): string {
  if (unit === 'L') return '€/L'
  if (unit === 'KG') return '€/kg'
  if (unit === 'PIECE') return '€/pc'
  return 'per item · size not detected'
}

export default function ReportsPage() {
  const { data: session } = useSession()
  const role = session?.user?.role
  // PREMIUM plus the elevated operator roles (ADMIN, TESTER); STANDARD sees the upsell.
  const isPremium = !!role && role !== 'STANDARD'

  const [mode, setMode] = useState<CompareMode>('own')
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

  const { series, labels, unitWarning } = useMemo(
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
            onChange={(e) => setPreset(e.target.value as TrendPreset)}
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
                  onChange={(e) => setFrom(e.target.value)}
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
                  onChange={(e) => setTo(e.target.value)}
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
            {selected.map((p) => (
              <span className="trend-chip" key={p.id}>
                {p.name}
                <button
                  type="button"
                  className="trend-x"
                  aria-label={`Remove ${p.name}`}
                  onClick={() => removeProduct(p.id)}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
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
          <span className="panel-title">Price per unit</span>
          <div className="trend-mode-row">
            <div className="trend-mode-toggle" role="group" aria-label="Comparison basis">
              <button
                type="button"
                className={`trend-mode-btn ${mode === 'own' ? 'is-active' : ''}`}
                aria-pressed={mode === 'own'}
                onClick={() => setMode('own')}
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
                onClick={() => isPremium && setMode('market')}
                data-testid="trends-mode-market"
              >
                {!isPremium && <Lock size={11} />} Local market
              </button>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {rangeInvalid ? 'Last 3 months' : rangeLabel}
            </span>
          </div>
        </div>
        <TrendChartBody
          loading={loading}
          hasProducts={selected.length > 0}
          comparison={comparison}
          mode={mode}
          series={series}
          labels={labels}
          unitWarning={unitWarning}
        />
      </Card>
    </div>
  )
}

function TrendChartBody({
  loading,
  hasProducts,
  comparison,
  mode,
  series,
  labels,
  unitWarning,
}: {
  loading: boolean
  hasProducts: boolean
  comparison: TrendComparison | null
  mode: CompareMode
  series: ChartSeries[]
  labels: string[]
  unitWarning: boolean
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
    const emptyCopy = !sourceEmpty
      ? 'No price points in this date range — widen the range to see more.'
      : mode === 'market'
        ? 'No local-store prices yet — comparison needs at least 3 confirmed scans nearby. Every scan makes it smarter.'
        : 'No prices yet — once you’ve scanned one of these items in this region it’ll chart here. Every scan makes it smarter.'
    return (
      <div className="table-empty" data-testid="trends-empty">
        <TrendingUp size={26} />
        <span>{emptyCopy}</span>
      </div>
    )
  }

  return (
    <>
      {unitWarning && (
        <div className="trend-unit-caveat" data-testid="trends-unit-caveat" role="note">
          <Clock size={13} />
          <span>
            Sizes aren’t detected for some items, so those lines show price <strong>per item</strong> —
            not a per-unit value.{' '}
            {mode === 'market'
              ? 'Confirm a size on the receipt to compare across stores.'
              : 'Confirm a size on the receipt to track the per-unit price.'}
          </span>
        </div>
      )}
      <LineChart series={series} months={labels} />
      <div className="trend-legend">
        {series.map((s) => {
          const vals = s.data.filter((v): v is number => v !== null)
          const now = vals.length ? vals[vals.length - 1] : null
          const delta = vals.length > 1 ? ((vals[vals.length - 1] - vals[0]) / vals[0]) * 100 : null
          return (
            <div className="legend-item" key={s.id}>
              <span className="dot" style={{ background: s.color, opacity: s.stale ? 0.5 : 1 }} />
              <div className="legend-meta">
                <span className="legend-name">
                  {s.product} · <strong>{s.merchant}</strong>
                  <span className="legend-unit" title={s.unit ? 'comparable per-unit price' : 'size not detected — price per item'}>
                    {unitLabel(s.unit)}
                  </span>
                  {s.stale && (
                    <span className="legend-stale" title={`No data for ${s.staleDays} days`}>
                      <Clock size={11} /> stale · {s.staleDays}d
                    </span>
                  )}
                </span>
                <span className="legend-now">
                  {now !== null ? `€${now.toFixed(2)}` : '—'}
                  {delta !== null && (
                    <span
                      className="legend-delta"
                      style={{ color: delta > 0 ? 'var(--danger)' : 'var(--success)' }}
                    >
                      {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
                    </span>
                  )}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </>
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
): { series: ChartSeries[]; labels: string[]; unitWarning: boolean } {
  // Only the active mode's source feeds the chart — own purchases or the market trend, never both.
  const sourceLines = mode === 'market' ? comparison?.lines ?? [] : comparison?.ownHistory ?? []
  if (!comparison || sourceLines.length === 0) {
    return { series: [], labels: [], unitWarning: false }
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
            product,
            merchant: l.merchantName,
            name: `${product} · ${l.merchantName}`,
            color: SERIES_COLORS[i % SERIES_COLORS.length],
            data: weeks.map((w) => median.get(w) ?? null),
            discounts: weeks.map((w) => discount.get(w) ?? null),
            stale: l.stale,
            staleDays: l.staleDays,
            own: false,
            unit: l.unit,
          }
        })
      : comparison.ownHistory.map((l, i) => {
          const median = new Map(l.points.map((pt) => [pt.weekStart, pt.median]))
          const discount = new Map(l.points.map((pt) => [pt.weekStart, pt.discountMedian]))
          const product = nameById.get(l.productId) ?? l.productId
          return {
            id: `own|${l.productId}`,
            product,
            merchant: OWN_LABEL,
            name: `${product} · ${OWN_LABEL}`,
            color: SERIES_COLORS[i % SERIES_COLORS.length],
            data: weeks.map((w) => median.get(w) ?? null),
            discounts: weeks.map((w) => discount.get(w) ?? null),
            stale: false,
            staleDays: 0,
            own: true,
            unit: l.unit,
          }
        })

  // A line with no points in the visible range adds only noise to the legend.
  const visible = modeSeries.filter(
    (s) => s.data.some((v) => v !== null) || s.discounts.some((v) => v !== null),
  )
  // Honesty guard: warn when any visible line has an unknown size (per-item) or the visible
  // lines mix units — those lines are NOT directly comparable across stores.
  const units = new Set(visible.map((s) => s.unit))
  const unitWarning = units.has(null) || [...units].filter((u) => u !== null).length > 1
  return { series: visible, labels, unitWarning }
}

function daysBack(n: number): Date {
  return new Date(Date.now() - n * 86_400_000)
}

function inRange(d: Date, preset: TrendPreset, from: string, to: string, rangeInvalid: boolean): boolean {
  const today = new Date()
  if (preset === '30d') return d >= daysBack(30)
  if (preset === '6m') return d >= daysBack(183)
  // The week axis is built from `${w}T00:00:00Z` (UTC), so the month comparison must be UTC
  // on both sides — mixing local `today.getMonth()` mis-includes/drops a week near boundaries.
  if (preset === 'month')
    return d.getUTCMonth() === today.getUTCMonth() && d.getUTCFullYear() === today.getUTCFullYear()
  if (preset === 'custom' && !rangeInvalid && from && to)
    return d >= new Date(from) && d <= new Date(to)
  return d >= daysBack(90)
}
