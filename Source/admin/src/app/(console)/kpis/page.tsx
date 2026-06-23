'use client'

import { useCallback, useEffect, useState } from 'react'
import { Sparkline } from '@/components/ui/sparkline'

interface KpiPoint {
  metricDate: string
  metricName: string
  value: number
  dimensions: Record<string, string> | null
}

// Headline stat cards (latest value) + churn flagged as a known gap (no
// subscription-cancellation signal yet — Epic 15).
const CARDS: { metric: string; label: string; format: (v: number) => string }[] = [
  { metric: 'registrations', label: 'Registrations (today)', format: (v) => String(v) },
  { metric: 'dau', label: 'DAU', format: (v) => String(v) },
  { metric: 'premium_count', label: 'Premium subscribers', format: (v) => String(v) },
  { metric: 'mrr_eur', label: 'MRR (est.)', format: (v) => `€${v.toFixed(2)}` },
  { metric: 'conversion_rate', label: 'Conversion', format: (v) => `${(v * 100).toFixed(1)}%` },
]

const SPARKS = ['registrations', 'dau', 'mau', 'premium_count', 'mrr_eur', 'feedback_score']

export default function KpisPage() {
  const [points, setPoints] = useState<KpiPoint[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const res = await fetch(`/api/admin/kpis?${params}`)
    if (!res.ok) {
      setError('Failed to load KPIs')
      return
    }
    setError(null)
    setPoints((await res.json()).points ?? [])
  }, [from, to])

  useEffect(() => {
    void load()
  }, [load])

  const series = (metric: string) =>
    points.filter((p) => p.metricName === metric && !p.dimensions).sort((a, b) => a.metricDate.localeCompare(b.metricDate))
  const latest = (metric: string) => series(metric).at(-1)?.value

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-fg">KPI Dashboard</h1>
        <div className="flex items-end gap-2" data-testid="kpi-range">
          <label className="text-xs text-muted">
            From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="ml-1 rounded border border-line px-2 py-1" data-testid="kpi-from" />
          </label>
          <label className="text-xs text-muted">
            To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="ml-1 rounded border border-line px-2 py-1" data-testid="kpi-to" />
          </label>
        </div>
      </div>

      {error && <p className="text-xs text-danger" role="alert">{error}</p>}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5" data-testid="kpi-cards">
        {CARDS.map((c) => {
          const v = latest(c.metric)
          return (
            <div key={c.metric} className="rounded-[12px] border border-line bg-card p-4">
              <p className="text-xs text-muted">{c.label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-fg">
                {v === undefined ? '—' : c.format(v)}
              </p>
            </div>
          )
        })}
      </div>

      <div className="rounded-[12px] border border-warning/40 bg-warning-soft p-3 text-xs text-warning">
        Churn rate is not yet rolled up — no subscription-cancellation signal exists in the schema (Epic 15 gap).
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2" data-testid="kpi-sparklines">
        {SPARKS.map((metric) => {
          const s = series(metric)
          return (
            <div key={metric} className="rounded-[12px] border border-line bg-card p-4">
              <p className="mb-2 text-sm font-medium text-fg">
                {metric === 'feedback_score' ? 'Feedback score (UP ratio)' : metric}
              </p>
              <Sparkline values={s.map((p) => p.value)} height={48} className="w-full" />
            </div>
          )
        })}
      </section>
    </div>
  )
}
