'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Chart, type ChartSeries } from '@/components/ui/chart'
import { BarList } from '@/components/ui/mini-bars'

interface KpiPoint {
  metricDate: string
  metricName: string
  value: number
  dimensions: Record<string, string> | null
}

type Bucket = 'day' | 'week'
const ALL = 'ALL'

const GREEN = '#10b981'
const RED = '#f43f5e'
const GREY = '#94a3b8'

// Overview headline cards (de-duplicated: registrations lives in Growth, premium in
// User base). Each carries a one-line description.
const OVERVIEW: { metric: string; label: string; desc: string; format: (v: number) => string }[] = [
  { metric: 'operational_efficiency', label: 'Operational efficiency', desc: '0.6·success + 0.4·feedback quality', format: (v) => `${v}%` },
  { metric: 'total_users', label: 'Total users', desc: 'all accounts (point-in-time)', format: (v) => v.toLocaleString() },
  { metric: 'mrr_eur', label: 'MRR (est.)', desc: 'premium × €4.99/mo', format: (v) => `€${v.toFixed(2)}` },
  { metric: 'conversion_rate', label: 'Conversion', desc: 'premium ÷ active users', format: (v) => `${(v * 100).toFixed(1)}%` },
  { metric: 'invoices_pending', label: 'Invoices pending', desc: 'status PROCESSING now', format: (v) => v.toLocaleString() },
]

const USER_BASE: { metric: string; label: string; desc: string }[] = [
  { metric: 'standard_users', label: 'Standard', desc: 'free-tier accounts' },
  { metric: 'premium_count', label: 'Premium', desc: 'paid subscribers' },
  { metric: 'active_users', label: 'Active', desc: 'status ACTIVE' },
  { metric: 'waitlist_users', label: 'Waitlist', desc: 'awaiting a slot' },
  { metric: 'deleted_users', label: 'Deleted', desc: 'soft-locked (30-day window)' },
  { metric: 'users_low_score', label: 'Low trust score', desc: 'trust score < 30' },
]

const GROWTH: { metric: string; label: string }[] = [
  { metric: 'registrations', label: 'New users / day' },
  { metric: 'dau', label: 'Daily active users (DAU)' },
  { metric: 'mau', label: 'Monthly active users (MAU)' },
  { metric: 'mrr_eur', label: 'MRR (€, est.)' },
]

export default function DashboardPage() {
  const [points, setPoints] = useState<KpiPoint[]>([])
  const [bucket, setBucket] = useState<Bucket>('day')
  const [country, setCountry] = useState(ALL)
  const [from, setFrom] = useState(() => currentWeek().from)
  const [to, setTo] = useState(() => currentWeek().to)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const res = await fetch(`/api/admin/kpis?${params}`)
    if (!res.ok) return setError('Failed to load KPIs')
    setError(null)
    setPoints((await res.json()).points ?? [])
  }, [from, to])

  useEffect(() => {
    void load()
  }, [load])

  const countries = [...new Set(points.map((p) => p.dimensions?.country).filter(Boolean) as string[])].sort()
  const inCountry = (p: KpiPoint) => country === ALL || p.dimensions?.country === country

  // Country-aware national/per-country series; falls back to national for metrics
  // without per-country rows (products, ingestion timing).
  const series = (metric: string): KpiPoint[] => {
    const forMetric = points.filter((p) => p.metricName === metric)
    const national = forMetric.filter((p) => !p.dimensions)
    if (country === ALL) return sortByDate(national)
    const per = forMetric.filter((p) => p.dimensions?.country === country && !p.dimensions?.region)
    return sortByDate(per.length > 0 ? per : national)
  }
  const latest = (m: string) => series(m).at(-1)?.value
  const total = (m: string) => series(m).reduce((a, p) => a + p.value, 0)

  // Build aligned chart series across several metrics for the current bucket.
  const chartData = (metrics: { metric: string; label: string; color: string }[]): { xLabels: string[]; series: ChartSeries[] } => {
    const per = metrics.map((m) => ({ ...m, buckets: aggregate(series(m.metric), bucket) }))
    const labels = [...new Set(per.flatMap((p) => p.buckets.map((b) => b.label)))].sort()
    return {
      xLabels: labels.map((l) => (l.length === 10 ? l.slice(5) : l)),
      series: per.map((p) => {
        const map = new Map(p.buckets.map((b) => [b.label, b.value]))
        return { label: p.label, color: p.color, values: labels.map((l) => map.get(l) ?? 0) }
      }),
    }
  }

  const pipeline = chartData([
    { metric: 'invoices_processed', label: 'Processed', color: GREEN },
    { metric: 'invoices_failed', label: 'Failed', color: RED },
  ])
  const feedback = chartData([
    { metric: 'invoices_feedback_positive', label: 'Positive', color: GREEN },
    { metric: 'invoices_feedback_negative', label: 'Negative', color: RED },
    { metric: 'invoices_feedback_none', label: 'No feedback', color: GREY },
  ])
  const processingByStatus = latestByStatus(points, 'ingestion_processing_ms_avg')
  const countByStatus = new Map(latestByStatus(points, 'ingestion_count').map((s) => [s.status, s.value]))
  const fbScore = latest('feedback_score')

  const merchantsByCountry = aggregateByCountry(points.filter((p) => p.metricName === 'new_merchants' && inCountry(p)))
  const invoicesByRegion = aggregateByRegion(points.filter((p) => p.metricName === 'invoices_by_region' && inCountry(p)))

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <h1 className="text-2xl font-bold text-fg">Dashboard</h1>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-end sm:gap-3">
          <Field label="Country">
            <select value={country} onChange={(e) => setCountry(e.target.value)} className="w-full rounded border border-line bg-card px-2 py-1 text-fg" data-testid="kpi-country">
              <option value={ALL}>All countries</option>
              {countries.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="From"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full rounded border border-line bg-card px-2 py-1 text-fg" data-testid="kpi-from" /></Field>
          <Field label="To"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full rounded border border-line bg-card px-2 py-1 text-fg" data-testid="kpi-to" /></Field>
          <div className="col-span-2 sm:col-auto">
            <Toggle value={bucket} onChange={setBucket} options={[['day', 'Daily'], ['week', 'Weekly']]} testid="kpi-bucket" />
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-danger" role="alert">{error}</p>}

      {/* Overview */}
      <Section title="Overview">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5" data-testid="kpi-cards">
          {OVERVIEW.map((c) => (
            <Card key={c.metric} label={c.label} desc={c.desc} value={latest(c.metric) === undefined ? '—' : c.format(latest(c.metric) as number)} />
          ))}
        </div>
      </Section>

      {/* Invoice pipeline */}
      <Section title="Invoice pipeline" hint="by upload date">
        <div className="rounded-[12px] border border-line bg-card p-4">
          <Chart series={pipeline.series} xLabels={pipeline.xLabels} type="area" height={160} testid="kpi-pipeline" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card label="Processed (range)" value={total('invoices_processed').toLocaleString()} />
          <Card label="Failed (range)" value={total('invoices_failed').toLocaleString()} />
          <Card label="Pending (now)" value={(latest('invoices_pending') ?? 0).toLocaleString()} />
          <Card label="New products (range)" value={total('new_products').toLocaleString()} />
        </div>
        {processingByStatus.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-muted">Average processing time (per status)</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="kpi-processing-time">
              {processingByStatus.map((s) => (
                <Card key={s.status} label={s.status} value={`${(s.value / 1000).toFixed(1)}s`} desc={`${(countByStatus.get(s.status) ?? 0).toLocaleString()} invoices`} />
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* Feedback */}
      <Section title="Feedback on processed invoices" hint="by upload date">
        <div className="rounded-[12px] border border-line bg-card p-4">
          <Chart series={feedback.series} xLabels={feedback.xLabels} type="area" height={160} testid="kpi-feedback" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card label="Positive (range)" value={total('invoices_feedback_positive').toLocaleString()} />
          <Card label="Negative (range)" value={total('invoices_feedback_negative').toLocaleString()} />
          <Card label="No feedback (range)" value={total('invoices_feedback_none').toLocaleString()} />
          <Card label="Feedback score" desc="UP ÷ total votes" value={fbScore === undefined ? '—' : `${(fbScore * 100).toFixed(0)}%`} />
        </div>
      </Section>

      {/* Growth trends */}
      <Section title="Growth trends">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2" data-testid="kpi-growth">
          {GROWTH.map(({ metric, label }) => {
            const d = chartData([{ metric, label, color: GREEN }])
            return (
              <div key={metric} className="rounded-[12px] border border-line bg-card p-4">
                <p className="mb-2 text-sm font-medium text-fg">{label}</p>
                <Chart series={d.series} xLabels={d.xLabels} type="line" height={120} formatY={metric === 'mrr_eur' ? (v) => `€${v}` : undefined} />
              </div>
            )
          })}
        </div>
      </Section>

      {/* User base */}
      <Section title="User base" hint="point-in-time totals">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6" data-testid="kpi-users">
          {USER_BASE.map((c) => (
            <Card key={c.metric} label={c.label} desc={c.desc} value={(latest(c.metric) ?? 0).toLocaleString()} />
          ))}
        </div>
      </Section>

      {/* Geography */}
      <Section title="Geography">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted">New merchants by country</p>
            {merchantsByCountry.length === 0 ? (
              <p className="text-xs text-muted">No new merchants in this range.</p>
            ) : (
              <div className="rounded-[12px] border border-line bg-card p-4">
                <BarList rows={merchantsByCountry.map((m) => ({ label: m.country, value: m.count }))} testid="kpi-merchants-country" />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted">Invoices by country / region</p>
            {invoicesByRegion.length === 0 ? (
              <p className="text-xs text-muted">No located invoices in this range.</p>
            ) : (
              <div className="rounded-[12px] border border-line bg-card p-4">
                <BarList rows={invoicesByRegion.map((r) => ({ label: r.region ? `${r.country} · ${r.region}` : r.country, value: r.count }))} testid="kpi-invoices-region" />
              </div>
            )}
          </div>
        </div>
      </Section>

      <p className="text-xs text-faint">
        Churn rate not yet rolled up (no cancellation signal). New merchant/product counts accurate from
        2026-06-23. Charts respect the country filter; AI spend &amp; processing time are infra-wide (national).
      </p>
    </div>
  )
}

// ── presentational helpers ──────────────────────────────────────────────────
function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-fg">
        {title} {hint && <span className="font-normal text-faint">· {hint}</span>}
      </h2>
      {children}
    </section>
  )
}

function Card({ label, value, desc }: { label: string; value: string; desc?: string }) {
  return (
    <div className="rounded-[12px] border border-line bg-card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-fg">{value}</p>
      {desc && <p className="mt-0.5 text-[11px] text-faint">{desc}</p>}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted">
      {label}
      {children}
    </label>
  )
}

function Toggle<T extends string>({ value, onChange, options, testid }: { value: T; onChange: (v: T) => void; options: [T, string][]; testid: string }) {
  return (
    <div className="flex rounded-[8px] border border-line p-0.5" data-testid={testid}>
      {options.map(([v, label]) => (
        <button key={v} onClick={() => onChange(v)} className={`rounded-[6px] px-3 py-1 text-xs font-medium ${value === v ? 'bg-brand text-white' : 'text-muted hover:text-fg'}`}>
          {label}
        </button>
      ))}
    </div>
  )
}

// ── data helpers ────────────────────────────────────────────────────────────
function latestByStatus(points: KpiPoint[], metric: string) {
  const byStatus = new Map<string, { date: string; value: number }>()
  for (const p of points) {
    const status = p.dimensions?.status
    if (p.metricName !== metric || !status) continue
    const prev = byStatus.get(status)
    if (!prev || p.metricDate > prev.date) byStatus.set(status, { date: p.metricDate, value: p.value })
  }
  return [...byStatus.entries()].map(([status, v]) => ({ status, value: v.value }))
}

function aggregate(points: KpiPoint[], bucket: Bucket): { label: string; value: number }[] {
  if (bucket === 'day') return points.map((p) => ({ label: p.metricDate, value: p.value }))
  const buckets = new Map<string, number>()
  for (const p of points) buckets.set(isoWeek(p.metricDate), (buckets.get(isoWeek(p.metricDate)) ?? 0) + p.value)
  return [...buckets.entries()].sort().map(([label, value]) => ({ label, value }))
}

function aggregateByCountry(points: KpiPoint[]): { country: string; count: number }[] {
  const totals = new Map<string, number>()
  for (const p of points) totals.set(p.dimensions?.country ?? '—', (totals.get(p.dimensions?.country ?? '—') ?? 0) + p.value)
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

function sortByDate(points: KpiPoint[]): KpiPoint[] {
  return [...points].sort((a, b) => a.metricDate.localeCompare(b.metricDate))
}

function currentWeek(): { from: string; to: string } {
  const today = new Date()
  const day = (today.getUTCDay() + 6) % 7
  const monday = new Date(today)
  monday.setUTCDate(today.getUTCDate() - day)
  return { from: monday.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) }
}

function isoWeek(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  const day = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - day + 3)
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}
