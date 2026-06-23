'use client'

import { useCallback, useEffect, useState } from 'react'
import { Sparkline } from '@/components/ui/sparkline'
import { MiniBars, BarList } from '@/components/ui/mini-bars'

interface KpiPoint {
  metricDate: string
  metricName: string
  value: number
  dimensions: Record<string, string> | null
}

type Bucket = 'day' | 'week'

const CARDS: { metric: string; label: string; format: (v: number) => string }[] = [
  { metric: 'registrations', label: 'Registrations (today)', format: (v) => String(v) },
  { metric: 'dau', label: 'DAU', format: (v) => String(v) },
  { metric: 'premium_count', label: 'Premium subscribers', format: (v) => String(v) },
  { metric: 'mrr_eur', label: 'MRR (est.)', format: (v) => `€${v.toFixed(2)}` },
  { metric: 'conversion_rate', label: 'Conversion', format: (v) => `${(v * 100).toFixed(1)}%` },
]

const HEADLINE_SPARKS = ['registrations', 'dau', 'mau', 'premium_count', 'mrr_eur', 'feedback_score']

// User-base breakdown (point-in-time totals, latest value).
const USER_CARDS: { metric: string; label: string }[] = [
  { metric: 'total_users', label: 'Total users' },
  { metric: 'registrations', label: 'New users (today)' },
  { metric: 'standard_users', label: 'Standard' },
  { metric: 'premium_count', label: 'Premium' },
  { metric: 'waitlist_users', label: 'Waitlist' },
  { metric: 'deleted_users', label: 'Deleted' },
]

// Operational counts the user asked to see per day and per week.
const OPS_METRICS: { metric: string; label: string }[] = [
  { metric: 'invoices_processed', label: 'Invoices processed' },
  { metric: 'invoices_failed', label: 'Invoices failed' },
  { metric: 'feedback_up', label: 'Positive feedback' },
  { metric: 'feedback_down', label: 'Negative feedback' },
  { metric: 'new_products', label: 'New products' },
]

export default function KpisPage() {
  const [points, setPoints] = useState<KpiPoint[]>([])
  const [bucket, setBucket] = useState<Bucket>('day')
  // Default the range to the current week (Monday → today).
  const [from, setFrom] = useState(() => currentWeek().from)
  const [to, setTo] = useState(() => currentWeek().to)
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
    points
      .filter((p) => p.metricName === metric && !p.dimensions)
      .sort((a, b) => a.metricDate.localeCompare(b.metricDate))
  const latest = (metric: string) => series(metric).at(-1)?.value
  const bucketed = (metric: string) => aggregate(series(metric), bucket)
  const total = (metric: string) => series(metric).reduce((acc, p) => acc + p.value, 0)

  // new_merchants: dimensioned by country — total per country over the range.
  const merchantsByCountry = aggregateByCountry(points.filter((p) => p.metricName === 'new_merchants'))
  // invoices_by_region: dimensioned by country + region — total over the range.
  const invoicesByRegion = aggregateByRegion(points.filter((p) => p.metricName === 'invoices_by_region'))

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
              <p className="mt-1 text-2xl font-bold tabular-nums text-fg">{v === undefined ? '—' : c.format(v)}</p>
            </div>
          )
        })}
      </div>

      {/* Live snapshot — point-in-time */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3" data-testid="kpi-snapshot">
        <SnapshotCard label="Invoices pending" value={latest('invoices_pending')} />
        <SnapshotCard label="Users with low score" value={latest('users_low_score')} />
      </div>

      {/* User base — point-in-time totals */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-fg">User base</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6" data-testid="kpi-users">
          {USER_CARDS.map(({ metric, label }) => {
            const v = latest(metric)
            return (
              <div key={metric} className="rounded-[12px] border border-line bg-card p-4">
                <p className="text-xs text-muted">{label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-fg">
                  {v === undefined ? '—' : v.toLocaleString()}
                </p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Operations: invoices, feedback, products — per day or per week */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-fg">Operations</h2>
          <div className="flex rounded-[8px] border border-line p-0.5" data-testid="kpi-bucket">
            {(['day', 'week'] as Bucket[]).map((b) => (
              <button
                key={b}
                onClick={() => setBucket(b)}
                className={`rounded-[6px] px-3 py-1 text-xs font-medium ${
                  bucket === b ? 'bg-brand text-white' : 'text-muted hover:text-fg'
                }`}
              >
                {b === 'day' ? 'Daily' : 'Weekly'}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="kpi-ops">
          {OPS_METRICS.map(({ metric, label }) => {
            const buckets = bucketed(metric)
            return (
              <div key={metric} className="rounded-[12px] border border-line bg-card p-4">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-medium text-fg">{label}</p>
                  <p className="text-xs text-muted">
                    {total(metric).toLocaleString()} total · {bucket === 'day' ? 'daily' : 'weekly'}
                  </p>
                </div>
                <MiniBars values={buckets.map((b) => b.value)} height={44} className="mt-2 w-full" />
              </div>
            )
          })}
        </div>
      </section>

      {/* New merchants per country (over the range) */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-fg">New merchants by country</h2>
        {merchantsByCountry.length === 0 ? (
          <p className="text-xs text-muted">No new merchants in this range.</p>
        ) : (
          <div className="rounded-[12px] border border-line bg-card p-4">
            <BarList
              rows={merchantsByCountry.map((m) => ({ label: m.country, value: m.count }))}
              testid="kpi-merchants-country"
            />
          </div>
        )}
      </section>

      {/* Invoices by country / region (over the range) */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-fg">Invoices by country / region</h2>
        {invoicesByRegion.length === 0 ? (
          <p className="text-xs text-muted">No located invoices in this range.</p>
        ) : (
          <div className="rounded-[12px] border border-line bg-card p-4">
            <BarList
              rows={invoicesByRegion.map((r) => ({
                label: r.region ? `${r.country} · ${r.region}` : r.country,
                value: r.count,
              }))}
              testid="kpi-invoices-region"
            />
          </div>
        )}
      </section>

      <div className="rounded-[12px] border border-warning/40 bg-warning-soft p-3 text-xs text-warning">
        Churn rate is not yet rolled up — no subscription-cancellation signal exists in the schema (Epic 15 gap).
        New merchant/product counts are accurate only from 2026-06-23 (creation timestamps added then).
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2" data-testid="kpi-sparklines">
        {HEADLINE_SPARKS.map((metric) => {
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

interface Series {
  metricDate: string
  value: number
}

// Sums a daily series into ISO-week buckets when bucket === 'week'.
function aggregate(series: Series[], bucket: Bucket): { label: string; value: number }[] {
  if (bucket === 'day') return series.map((p) => ({ label: p.metricDate, value: p.value }))
  const buckets = new Map<string, number>()
  for (const p of series) {
    const key = isoWeek(p.metricDate)
    buckets.set(key, (buckets.get(key) ?? 0) + p.value)
  }
  return [...buckets.entries()].sort().map(([label, value]) => ({ label, value }))
}

function aggregateByCountry(points: KpiPoint[]): { country: string; count: number }[] {
  const totals = new Map<string, number>()
  for (const p of points) {
    const country = p.dimensions?.country ?? '—'
    totals.set(country, (totals.get(country) ?? 0) + p.value)
  }
  return [...totals.entries()].map(([country, count]) => ({ country, count })).sort((a, b) => b.count - a.count)
}

function aggregateByRegion(points: KpiPoint[]): { country: string; region: string; count: number }[] {
  const totals = new Map<string, { country: string; region: string; count: number }>()
  for (const p of points) {
    const country = p.dimensions?.country ?? '—'
    const region = p.dimensions?.region ?? ''
    const key = `${country}|${region}`
    const cur = totals.get(key) ?? { country, region, count: 0 }
    cur.count += p.value
    totals.set(key, cur)
  }
  return [...totals.values()].sort((a, b) => b.count - a.count)
}

function currentWeek(): { from: string; to: string } {
  const today = new Date()
  const day = (today.getUTCDay() + 6) % 7 // 0 = Monday
  const monday = new Date(today)
  monday.setUTCDate(today.getUTCDate() - day)
  return { from: monday.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) }
}

function SnapshotCard({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-[12px] border border-line bg-card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-fg">
        {value === undefined ? '—' : value.toLocaleString()}
      </p>
    </div>
  )
}

function isoWeek(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  const day = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - day + 3)
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const week =
    1 +
    Math.round(
      ((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7,
    )
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}
