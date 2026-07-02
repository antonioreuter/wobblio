'use client'

import { useCallback, useEffect, useState } from 'react'
import { Activity, RefreshCw } from 'lucide-react'
import { ConsoleSection } from '@/components/ui/console-section'
import { Sparkline } from '@/components/ui/sparkline'
import { StatTile } from './stat-tile'
import type { QueueHealth } from './types'

interface MetricPoint {
  timestamp: string
  invocations: number
  errors: number
}

const REFRESH_MS = 15000

export function QueueHealthSection() {
  const [health, setHealth] = useState<QueueHealth | null>(null)
  const [series, setSeries] = useState<MetricPoint[]>([])
  const [auto, setAuto] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [h, m] = await Promise.all([
      fetch('/api/admin/troubleshooting/queue-health'),
      fetch('/api/admin/troubleshooting/metrics?hours=24'),
    ])
    if (!h.ok || !m.ok) {
      setError('Failed to load queue health')
      return
    }
    setError(null)
    setHealth(await h.json())
    setSeries((await m.json()).series ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!auto) return
    const id = setInterval(() => void load(), REFRESH_MS)
    return () => clearInterval(id)
  }, [auto, load])

  const totals = series.reduce(
    (acc, p) => ({ invocations: acc.invocations + p.invocations, errors: acc.errors + p.errors }),
    { invocations: 0, errors: 0 },
  )
  const errorPct = totals.invocations > 0 ? (totals.errors / totals.invocations) * 100 : 0

  return (
    <ConsoleSection
      id="health"
      icon={Activity}
      title="Queue Health"
      description="Live ingestion queue depth and the worker error rate over the last 24h."
      headerAside={
        <button
          type="button"
          onClick={() => setAuto((a) => !a)}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${auto ? 'border-brand text-brand' : 'border-line text-muted hover:text-fg'}`}
          data-testid="health-autorefresh"
        >
          <RefreshCw size={12} strokeWidth={1.5} />
          {auto ? 'Live' : 'Paused'}
        </button>
      }
    >
      {error && <p className="text-xs text-danger" role="alert">{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="queue-health">
        <StatTile label="Queue depth" value={health?.queueDepth} />
        <StatTile label="In flight" value={health?.inFlight} />
        <StatTile label="DLQ" value={health?.dlqDepth} tone={health && health.dlqDepth > 0 ? 'text-danger' : 'text-fg'} />
        <div className="flex flex-col justify-between rounded-[12px] border border-line bg-card p-4">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Errors / 24h</span>
            <span className={errorPct > 5 ? 'text-danger' : 'text-muted'}>{errorPct.toFixed(1)}%</span>
          </div>
          <Sparkline values={series.map((p) => p.errors)} className="mt-2 w-full" height={32} />
          <p className="mt-1 text-xs tabular-nums text-faint">
            {totals.errors.toLocaleString()} err · {totals.invocations.toLocaleString()} runs
          </p>
        </div>
      </div>
    </ConsoleSection>
  )
}
