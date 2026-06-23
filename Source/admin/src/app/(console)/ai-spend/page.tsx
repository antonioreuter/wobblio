'use client'

import { useCallback, useEffect, useState } from 'react'

interface KpiPoint {
  metricDate: string
  metricName: string
  value: number
  dimensions: Record<string, string> | null
}

const ROLE_COLOR: Record<string, string> = {
  vision_parser: '#0d9488',
  auxiliary: '#6366f1',
  insight: '#d97706',
  embedder: '#16a34a',
}

export default function AiSpendPage() {
  const [points, setPoints] = useState<KpiPoint[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const res = await fetch(`/api/admin/ai-spend?${params}`)
    if (!res.ok) {
      setError('Failed to load AI spend')
      return
    }
    setError(null)
    setPoints((await res.json()).points ?? [])
  }, [from, to])

  useEffect(() => {
    void load()
  }, [load])

  const tokens = points.filter((p) => p.metricName === 'ai_tokens')
  const costs = points.filter((p) => p.metricName === 'ai_cost')
  const roles = [...new Set(tokens.map((p) => p.dimensions?.model_role).filter(Boolean) as string[])]
  const dates = [...new Set(tokens.map((p) => p.metricDate))].sort()
  const maxDayTokens = Math.max(1, ...dates.map((d) => sumOn(tokens, d)))
  const totalCost = costs.reduce((acc, p) => acc + p.value, 0)
  const totalTokens = tokens.reduce((acc, p) => acc + p.value, 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#0f172a]">AI Spend</h1>
        <div className="flex items-end gap-2" data-testid="ai-spend-range">
          <label className="text-xs text-[#64748b]">
            From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="ml-1 rounded border border-[#e2e8f0] px-2 py-1" data-testid="ai-spend-from" />
          </label>
          <label className="text-xs text-[#64748b]">
            To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="ml-1 rounded border border-[#e2e8f0] px-2 py-1" data-testid="ai-spend-to" />
          </label>
        </div>
      </div>

      {error && <p className="text-xs text-[#dc2626]" role="alert">{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Stat label="Total tokens (range)" value={totalTokens.toLocaleString()} />
        <Stat label="Estimated cost (range)" value={`$${totalCost.toFixed(2)}`} />
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        {roles.map((r) => (
          <span key={r} className="inline-flex items-center gap-1.5 text-[#64748b]">
            <span className="h-2 w-2 rounded-full" style={{ background: ROLE_COLOR[r] ?? '#94a3b8' }} />
            {r}
          </span>
        ))}
      </div>

      <div className="rounded-[12px] border border-[#e2e8f0] bg-white p-4">
        <p className="mb-3 text-sm font-medium text-[#0f172a]">Daily tokens by model role</p>
        {dates.length === 0 ? (
          <p className="text-sm text-[#64748b]">No AI-spend rows in this range.</p>
        ) : (
          <div className="flex items-end gap-1" style={{ height: 180 }} data-testid="ai-spend-chart">
            {dates.map((d) => (
              <div key={d} className="flex flex-1 flex-col justify-end" title={`${d}: ${sumOn(tokens, d).toLocaleString()} tokens`}>
                {roles.map((r) => {
                  const v = valueOn(tokens, d, r)
                  if (v === 0) return null
                  return (
                    <div
                      key={r}
                      style={{ height: `${(v / maxDayTokens) * 160}px`, background: ROLE_COLOR[r] ?? '#94a3b8' }}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-[#94a3b8]">
        Aggregate-only (per-tenant ledger + cap removed 2026-06-22). Cost is an estimate from class-based token rates.
      </p>
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
    <div className="rounded-[12px] border border-[#e2e8f0] bg-white p-4">
      <p className="text-xs text-[#64748b]">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-[#0f172a]">{value}</p>
    </div>
  )
}
