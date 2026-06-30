'use client'

import { useEffect, useMemo, useState } from 'react'
import { Chart, type ChartSeries } from '@/components/ui/chart'

interface KpiPoint {
  metricDate: string
  metricName: string
  value: number
  dimensions: Record<string, string> | null
}

const PIPELINES = ['LEGACY', 'STRANDS'] as const
type Pipeline = (typeof PIPELINES)[number]

const METRIC = {
  latency: 'pipeline_avg_processing_ms',
  cost: 'pipeline_cost_per_invoice',
  reviewRate: 'pipeline_needs_review_rate',
  downRatio: 'pipeline_feedback_down_ratio',
}

const COLOR: Record<Pipeline, string> = { LEGACY: '#94a3b8', STRANDS: '#10b981' }
const RANGE_DAYS = 90

const fmtMs = (v: number): string => (v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`)
const fmtCost = (v: number): string => `$${v.toFixed(4)}`
const fmtPct = (v: number): string => `${(v * 100).toFixed(1)}%`

const scale = (
  chart: { xLabels: string[]; series: ChartSeries[] },
  factor: number,
): { xLabels: string[]; series: ChartSeries[] } => ({
  xLabels: chart.xLabels,
  series: chart.series.map((s) => ({ ...s, values: s.values.map((v) => v * factor) })),
})

// Self-contained 90-day legacy-vs-Strands comparison: its own kpi fetch (fixed window,
// independent of the dashboard's week selector) over the four pipeline_type-dimensioned
// metrics produced by the 06 rollup.
export function PipelineComparison() {
  const [points, setPoints] = useState<KpiPoint[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const to = new Date()
    const from = new Date(to.getTime() - RANGE_DAYS * 86400000)
    const params = new URLSearchParams({
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      metrics: Object.values(METRIC).join(','),
    })
    void (async () => {
      const res = await fetch(`/api/admin/kpis?${params}`)
      if (!res.ok) return setError('Failed to load pipeline comparison')
      setError(null)
      setPoints((await res.json()).points ?? [])
    })()
  }, [])

  const forMetric = useMemo(
    () => (metric: string, pipeline: Pipeline) =>
      points
        .filter((p) => p.metricName === metric && p.dimensions?.pipeline_type === pipeline)
        .sort((a, b) => a.metricDate.localeCompare(b.metricDate)),
    [points],
  )

  const latest = (metric: string, pipeline: Pipeline): number | undefined =>
    forMetric(metric, pipeline).at(-1)?.value

  // Aligned multi-line series (one line per pipeline) over the union of dates present.
  const chart = (metric: string): { xLabels: string[]; series: ChartSeries[] } => {
    const labels = [...new Set(points.filter((p) => p.metricName === metric).map((p) => p.metricDate))].sort()
    return {
      xLabels: labels.map((l) => l.slice(5)),
      series: PIPELINES.map((pipeline) => {
        const byDate = new Map(forMetric(metric, pipeline).map((p) => [p.metricDate, p.value]))
        return { label: pipeline, color: COLOR[pipeline], values: labels.map((l) => byDate.get(l) ?? 0) }
      }),
    }
  }

  const latency = chart(METRIC.latency)
  // Cost per invoice is sub-dollar; the chart rounds y-axis ticks to integers, so plot it in
  // cents (×100) to keep the axis labels meaningful (a dollar axis collapses to $0.000).
  const costCents = scale(chart(METRIC.cost), 100)

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-fg">
        Pipeline Performance Comparison <span className="font-normal text-faint">· legacy vs Strands · 90 days</span>
      </h2>

      {error && <p className="text-xs text-danger" role="alert">{error}</p>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" data-testid="pipeline-performance-cards">
        <CompareCard label="Avg latency" fmt={fmtMs} legacy={latest(METRIC.latency, 'LEGACY')} strands={latest(METRIC.latency, 'STRANDS')} lowerIsBetter />
        <CompareCard label="Cost / invoice" fmt={fmtCost} legacy={latest(METRIC.cost, 'LEGACY')} strands={latest(METRIC.cost, 'STRANDS')} lowerIsBetter />
        <CompareCard label="Needs-review rate" fmt={fmtPct} legacy={latest(METRIC.reviewRate, 'LEGACY')} strands={latest(METRIC.reviewRate, 'STRANDS')} lowerIsBetter />
        <CompareCard label="Feedback DOWN ratio" fmt={fmtPct} legacy={latest(METRIC.downRatio, 'LEGACY')} strands={latest(METRIC.downRatio, 'STRANDS')} lowerIsBetter />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-[12px] border border-line bg-card p-4">
          <p className="mb-2 text-sm font-medium text-fg">Average latency</p>
          <Chart series={latency.series} xLabels={latency.xLabels} type="line" height={160} formatY={fmtMs} testid="pipeline-performance-latency" />
        </div>
        <div className="rounded-[12px] border border-line bg-card p-4">
          <p className="mb-2 text-sm font-medium text-fg">Cost per invoice <span className="font-normal text-faint">· US¢</span></p>
          <Chart series={costCents.series} xLabels={costCents.xLabels} type="line" height={160} formatY={(v) => `${v}¢`} testid="pipeline-performance-cost" />
        </div>
      </div>
    </section>
  )
}

function CompareCard({
  label,
  fmt,
  legacy,
  strands,
  lowerIsBetter,
}: {
  label: string
  fmt: (v: number) => string
  legacy?: number
  strands?: number
  lowerIsBetter?: boolean
}) {
  const winner =
    legacy === undefined || strands === undefined || legacy === strands
      ? null
      : (lowerIsBetter ? strands < legacy : strands > legacy)
        ? 'STRANDS'
        : 'LEGACY'
  return (
    <div className="rounded-[12px] border border-line bg-card p-4">
      <p className="text-xs text-muted">{label}</p>
      <div className="mt-2 flex flex-col gap-1">
        <Row name="Legacy" value={legacy === undefined ? '—' : fmt(legacy)} highlight={winner === 'LEGACY'} color="#94a3b8" />
        <Row name="Strands" value={strands === undefined ? '—' : fmt(strands)} highlight={winner === 'STRANDS'} color="#10b981" />
      </div>
    </div>
  )
}

function Row({ name, value, highlight, color }: { name: string; value: string; highlight: boolean; color: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="inline-flex items-center gap-1.5 text-muted">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        {name}
      </span>
      <span className={`tabular-nums ${highlight ? 'font-bold text-success' : 'text-fg'}`}>{value}</span>
    </div>
  )
}
