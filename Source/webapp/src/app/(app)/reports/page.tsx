'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Calendar, Clock, Crown, Trash2, TrendingUp } from 'lucide-react'
import { Card } from '@/components/ds'
import {
  FilterSelect,
  LineChart,
  MAX_PRODUCTS,
  MONTHS,
  PRESETS,
  PriceTrendsHelpButton,
  ProductSearch,
  RegionPicker,
  SERIES_COLORS,
  usePriceTrends,
  type Preset,
  type TrendComparison,
  type TrendProduct,
} from '@/components/workspace'

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
}

const OWN_LABEL = 'Your purchases'

export default function ReportsPage() {
  const { data: session } = useSession()
  const role = session?.user?.role
  // PREMIUM plus the elevated operator roles (ADMIN, TESTER); STANDARD sees the upsell.
  const isPremium = !!role && role !== 'STANDARD'

  const [selected, setSelected] = useState<TrendProduct[]>([])
  const [country, setCountry] = useState('')
  const [region, setRegion] = useState('')
  const [preset, setPreset] = useState<Preset>('90d')
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
  const rangeInvalid = preset === 'custom' && from !== '' && to !== '' && (rangeDays < 0 || rangeDays > 92)

  const { series, labels } = useMemo(
    () => buildChart(comparison, selected, preset, from, to, rangeInvalid),
    [comparison, selected, preset, from, to, rangeInvalid],
  )
  const rangeLabel = PRESETS.find(([v]) => v === preset)?.[1] ?? 'Last 3 months'

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
            <ProductSearch onAdd={add} disabled={atMax} exclude={ids} />
          </div>
          <FilterSelect
            label="Date range"
            icon={<Calendar size={15} />}
            value={preset}
            onChange={(e) => setPreset(e.target.value as Preset)}
          >
            {PRESETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
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
            {rangeInvalid ? 'Range can’t exceed 3 months.' : `${series.length} lines · max range 6 months`}
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
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {rangeInvalid ? 'Last 3 months' : rangeLabel}
          </span>
        </div>
        <TrendChartBody
          loading={loading}
          hasProducts={selected.length > 0}
          comparison={comparison}
          series={series}
          labels={labels}
        />
      </Card>
    </div>
  )
}

function TrendChartBody({
  loading,
  hasProducts,
  comparison,
  series,
  labels,
}: {
  loading: boolean
  hasProducts: boolean
  comparison: TrendComparison | null
  series: ChartSeries[]
  labels: string[]
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
    const noServedData =
      !comparison || (comparison.lines.length === 0 && comparison.ownHistory.length === 0)
    return (
      <div className="table-empty" data-testid="trends-empty">
        <TrendingUp size={26} />
        <span>
          {noServedData
            ? 'No prices yet — once you’ve scanned one of these items in this region it’ll chart here. Local-store comparison needs at least 3 confirmed scans nearby. Every scan makes it smarter.'
            : 'No price points in this date range — widen the range to see more.'}
        </span>
      </div>
    )
  }

  return (
    <>
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
  preset: Preset,
  from: string,
  to: string,
  rangeInvalid: boolean,
): { series: ChartSeries[]; labels: string[] } {
  if (!comparison || (comparison.lines.length === 0 && comparison.ownHistory.length === 0)) {
    return { series: [], labels: [] }
  }

  const nameById = new Map(products.map((p) => [p.id, p.name]))
  const weekSet = new Set<string>()
  comparison.lines.forEach((l) => l.points.forEach((pt) => weekSet.add(pt.weekStart)))
  comparison.ownHistory.forEach((l) => l.points.forEach((pt) => weekSet.add(pt.weekStart)))
  const weeks = [...weekSet]
    .sort()
    .filter((w) => inRange(new Date(`${w}T00:00:00Z`), preset, from, to, rangeInvalid))

  const labels = weeks.map((w) => {
    const d = new Date(`${w}T00:00:00Z`)
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
  })

  // Market lines first (solid, one per store), then the caller's own purchases (dashed,
  // one per product) — never blended, so own vs market stays honest (§6.5.2).
  const marketSeries: ChartSeries[] = comparison.lines.map((l, i) => {
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
    }
  })

  const ownSeries: ChartSeries[] = comparison.ownHistory.map((l, i) => {
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
    }
  })

  // A line with no points in the visible range adds only noise to the legend.
  const visible = [...marketSeries, ...ownSeries].filter(
    (s) => s.data.some((v) => v !== null) || s.discounts.some((v) => v !== null),
  )
  return { series: visible, labels }
}

function daysBack(n: number): Date {
  return new Date(Date.now() - n * 86_400_000)
}

function inRange(d: Date, preset: Preset, from: string, to: string, rangeInvalid: boolean): boolean {
  const today = new Date()
  if (preset === '30d') return d >= daysBack(30)
  if (preset === 'month')
    return d.getUTCMonth() === today.getMonth() && d.getUTCFullYear() === today.getFullYear()
  if (preset === 'custom' && !rangeInvalid && from && to)
    return d >= new Date(from) && d <= new Date(to)
  return d >= daysBack(90)
}
