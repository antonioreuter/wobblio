'use client'

import { useState } from 'react'
import { Calendar, Clock, Search, Trash2, TrendingUp } from 'lucide-react'
import { Button, Card } from '@/components/ds'
import {
  daysAgo,
  FilterSelect,
  LineChart,
  MAX_PRODUCTS,
  MERCHANT_SHORT,
  MONTHS,
  PRESETS,
  ProductSearch,
  SERIES_COLORS,
  TODAY,
  TREND_DATA,
  TREND_PRODUCTS,
  TREND_WEEKS,
  type Preset,
} from '@/components/workspace'

export default function ReportsPage() {
  const [selected, setSelected] = useState<string[]>(['milk'])
  const [preset, setPreset] = useState<Preset>('90d')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [searching, setSearching] = useState(false)

  const atMax = selected.length >= MAX_PRODUCTS

  const lines = selected.flatMap((id) => {
    const pr = TREND_PRODUCTS.find((p) => p.id === id)
    if (!pr) return []
    return pr.stores.map(([m]) => ({
      id: `${id}|${m}`,
      product: pr.short,
      merchant: MERCHANT_SHORT[m] ?? m,
      name: `${pr.short} · ${MERCHANT_SHORT[m] ?? m}`,
      full: TREND_DATA[`${id}|${m}`],
    }))
  })

  const rangeDays =
    from && to ? Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) : 0
  const rangeInvalid = preset === 'custom' && from !== '' && to !== '' && (rangeDays < 0 || rangeDays > 92)

  const inRange = (d: Date) => {
    if (preset === '30d') return d >= daysAgo(30)
    if (preset === 'month')
      return d.getUTCMonth() === TODAY.getUTCMonth() && d.getUTCFullYear() === TODAY.getUTCFullYear()
    if (preset === 'custom' && !rangeInvalid && from && to)
      return d >= new Date(from) && d <= new Date(to)
    return d >= daysAgo(92)
  }

  const idx = TREND_WEEKS.map((d, i) => [d, i] as const).filter(([d]) => inRange(d)).map(([, i]) => i)
  const labels = idx.map((i) => {
    const d = TREND_WEEKS[i]
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
  })
  const series = lines.map((ln, i) => ({
    ...ln,
    color: SERIES_COLORS[i % SERIES_COLORS.length],
    data: idx.map((j) => ln.full[j]),
  }))
  const rangeLabel = PRESETS.find(([v]) => v === preset)?.[1] ?? 'Last 3 months'

  const add = (id: string) => {
    if (!atMax && !selected.includes(id)) setSelected((s) => [...s, id])
  }
  const removeProduct = (id: string) => setSelected((s) => s.filter((x) => x !== id))
  const clear = () => {
    setSelected([])
    setPreset('90d')
    setFrom('')
    setTo('')
  }
  const search = () => {
    setSearching(true)
    setTimeout(() => setSearching(false), 550)
  }

  return (
    <div className="pane">
      <h2 className="pane-title">Price Trends</h2>
      <p className="pane-subtitle">
        Compare an item across local stores over time — one line per store. Track up to {MAX_PRODUCTS} products.
      </p>

      <Card className="panel filter-card">
        <div className="filter-head">
          <TrendingUp size={15} /> <span>Filter price trends</span>
        </div>

        <div className="filter-grid">
          <div className="span-2">
            <ProductSearch onAdd={add} disabled={atMax} exclude={selected} />
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
            {selected.map((id) => {
              const pr = TREND_PRODUCTS.find((p) => p.id === id)
              if (!pr) return null
              return (
                <span className="trend-chip" key={id}>
                  {pr.short} <span className="trend-stores">{pr.stores.length} stores</span>
                  <button
                    type="button"
                    className="trend-x"
                    aria-label={`Remove ${pr.name}`}
                    onClick={() => removeProduct(id)}
                  >
                    ✕
                  </button>
                </span>
              )
            })}
          </div>
        </div>

        <div className="filter-foot">
          <span className={`filter-hint ${rangeInvalid ? 'invalid' : ''}`}>
            <Clock size={13} />
            {rangeInvalid ? 'Range can’t exceed 3 months.' : `${lines.length} lines · max range 3 months`}
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
            <Button
              variant="primary"
              disabled={rangeInvalid}
              style={{ padding: '9px 20px', fontSize: 13 }}
              onClick={search}
              iconLeft={searching ? null : <Search size={15} />}
            >
              {searching ? 'Searching…' : 'Search'}
            </Button>
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
        {series.length === 0 ? (
          <div className="table-empty">
            <TrendingUp size={26} />
            <span>Add a product above to start comparing prices across stores.</span>
          </div>
        ) : (
          <>
            <LineChart series={series} months={labels} />
            <div className="trend-legend">
              {series.map((s) => {
                const d = ((s.data[s.data.length - 1] - s.data[0]) / s.data[0]) * 100
                return (
                  <div className="legend-item" key={s.id}>
                    <span className="dot" style={{ background: s.color }} />
                    <div className="legend-meta">
                      <span className="legend-name">
                        {s.product} · <strong>{s.merchant}</strong>
                      </span>
                      <span className="legend-now">
                        €{s.data[s.data.length - 1].toFixed(2)}
                        <span
                          className="legend-delta"
                          style={{ color: d > 0 ? 'var(--danger)' : 'var(--success)' }}
                        >
                          {d > 0 ? '▲' : '▼'} {Math.abs(d).toFixed(1)}%
                        </span>
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
