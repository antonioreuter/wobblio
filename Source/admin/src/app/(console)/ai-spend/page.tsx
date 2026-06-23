'use client'

import { useCallback, useEffect, useState } from 'react'

interface KpiPoint {
  metricDate: string
  metricName: string
  value: number
  dimensions: Record<string, string> | null
}

interface ModelCostPoint {
  periodStart: string
  model: string
  cost: number
  tokens: number
}

type Source = 'estimated' | 'actual'
type Granularity = 'DAILY' | 'MONTHLY'

// Distinct, non-purple chart hues that read on both themes.
const ROLE_COLOR: Record<string, string> = {
  vision_parser: '#10b981',
  auxiliary: '#38bdf8',
  insight: '#f59e0b',
  embedder: '#a3e635',
}

export default function AiSpendPage() {
  const [source, setSource] = useState<Source>('estimated')
  const [granularity, setGranularity] = useState<Granularity>('DAILY')
  const [points, setPoints] = useState<KpiPoint[]>([])
  const [actual, setActual] = useState<ModelCostPoint[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const url =
      source === 'actual'
        ? `/api/admin/ai-spend/actual?granularity=${granularity}&${params}`
        : `/api/admin/ai-spend?${params}`
    const res = await fetch(url)
    if (!res.ok) {
      setError('Failed to load AI spend')
      return
    }
    setError(null)
    const data = await res.json()
    if (source === 'actual') setActual(data.points ?? [])
    else setPoints(data.points ?? [])
  }, [source, granularity, from, to])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-fg">AI Spend</h1>
        <div className="flex flex-wrap items-end gap-3">
          <Segmented
            value={source}
            options={[
              { value: 'estimated', label: 'Estimated (live)' },
              { value: 'actual', label: 'Actual (billed)' },
            ]}
            onChange={(v) => setSource(v as Source)}
            testid="ai-spend-source"
          />
          {source === 'actual' && (
            <Segmented
              value={granularity}
              options={[
                { value: 'DAILY', label: 'Daily' },
                { value: 'MONTHLY', label: 'Monthly' },
              ]}
              onChange={(v) => setGranularity(v as Granularity)}
              testid="ai-spend-granularity"
            />
          )}
          <div className="flex items-end gap-2" data-testid="ai-spend-range">
            <label className="text-xs text-muted">
              From
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="ml-1 rounded border border-line px-2 py-1" data-testid="ai-spend-from" />
            </label>
            <label className="text-xs text-muted">
              To
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="ml-1 rounded border border-line px-2 py-1" data-testid="ai-spend-to" />
            </label>
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-danger" role="alert">{error}</p>}

      {source === 'estimated' ? <EstimatedView points={points} /> : <ActualView points={actual} />}
    </div>
  )
}

function EstimatedView({ points }: { points: KpiPoint[] }) {
  const tokens = points.filter((p) => p.metricName === 'ai_tokens')
  const costs = points.filter((p) => p.metricName === 'ai_cost')
  const roles = [...new Set(tokens.map((p) => p.dimensions?.model_role).filter(Boolean) as string[])]
  const dates = [...new Set(tokens.map((p) => p.metricDate))].sort()
  const maxDayTokens = Math.max(1, ...dates.map((d) => sumOn(tokens, d)))
  const totalCost = costs.reduce((acc, p) => acc + p.value, 0)
  const totalTokens = tokens.reduce((acc, p) => acc + p.value, 0)

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Stat label="Total tokens (range)" value={totalTokens.toLocaleString()} />
        <Stat label="Estimated cost (range)" value={`$${totalCost.toFixed(2)}`} />
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        {roles.map((r) => (
          <span key={r} className="inline-flex items-center gap-1.5 text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: ROLE_COLOR[r] ?? '#94a3b8' }} />
            {r}
          </span>
        ))}
      </div>

      <div className="rounded-[12px] border border-line bg-card p-4">
        <p className="mb-3 text-sm font-medium text-fg">Daily tokens by model role</p>
        {dates.length === 0 ? (
          <p className="text-sm text-muted">No AI-spend rows in this range.</p>
        ) : (
          <div className="flex items-end gap-1" style={{ height: 180 }} data-testid="ai-spend-chart">
            {dates.map((d) => (
              <div key={d} className="flex flex-1 flex-col justify-end" title={`${d}: ${sumOn(tokens, d).toLocaleString()} tokens`}>
                {roles.map((r) => {
                  const v = valueOn(tokens, d, r)
                  if (v === 0) return null
                  return <div key={r} style={{ height: `${(v / maxDayTokens) * 160}px`, background: ROLE_COLOR[r] ?? '#94a3b8' }} />
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-faint">
        Estimated from <code>bedrock_usage</code> logs (token counts are real; cost = tokens × class-based rate). Near-real-time.
      </p>
    </>
  )
}

function ActualView({ points }: { points: ModelCostPoint[] }) {
  const totalCost = points.reduce((acc, p) => acc + p.cost, 0)
  const totalTokens = points.reduce((acc, p) => acc + p.tokens, 0)
  const rows = [...points].sort(
    (a, b) => a.periodStart.localeCompare(b.periodStart) || b.cost - a.cost,
  )

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Stat label="Total billed cost (range)" value={`$${totalCost.toFixed(4)}`} />
        <Stat label="Total tokens (range)" value={totalTokens.toLocaleString()} />
      </div>

      <div className="overflow-x-auto rounded-[12px] border border-line bg-card" data-testid="ai-spend-actual">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="p-3 font-medium">Period</th>
              <th className="p-3 font-medium">Model</th>
              <th className="p-3 text-right font-medium">Tokens</th>
              <th className="p-3 text-right font-medium">Cost (USD)</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-6 text-center text-sm text-muted">
                  No billed Bedrock cost in this range yet (Cost Explorer lags ~24–48h).
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={`${r.periodStart}-${r.model}`} className="border-b border-line">
                  <td className="p-3 text-muted">{r.periodStart}</td>
                  <td className="p-3 font-medium text-fg">{r.model}</td>
                  <td className="p-3 text-right tabular-nums">{r.tokens.toLocaleString()}</td>
                  <td className="p-3 text-right tabular-nums text-fg">${r.cost.toFixed(4)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-faint">
        Actual UnblendedCost from AWS Cost Explorer (Amazon Bedrock), grouped by model. Billed figures lag ~24–48h.
      </p>
    </>
  )
}

function Segmented({
  value,
  options,
  onChange,
  testid,
}: {
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  testid: string
}) {
  return (
    <div className="flex rounded-[8px] border border-line p-0.5" data-testid={testid}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-[6px] px-3 py-1 text-xs font-medium ${
            value === o.value ? 'bg-brand text-white' : 'text-muted hover:text-fg'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function sumOn(points: KpiPoint[], date: string): number {
  return points.filter((p) => p.metricDate === date).reduce((acc, p) => acc + p.value, 0)
}

function valueOn(points: KpiPoint[], date: string, role: string): number {
  return points.find((p) => p.metricDate === date && p.dimensions?.model_role === role)?.value ?? 0
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-line bg-card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-fg">{value}</p>
    </div>
  )
}
