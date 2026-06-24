'use client'

import { useCallback, useEffect, useState } from 'react'
import { Gauge, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ConsoleSection } from '@/components/ui/console-section'

type LogLevel = 'error' | 'warn' | 'info' | 'debug'

interface LogLevelState {
  configuredLevel: LogLevel
  effectiveLevel: LogLevel
  expiresAt: string | null
}

const LEVELS: LogLevel[] = ['error', 'warn', 'info', 'debug']
const TTL_OPTIONS = [15, 30, 60, 120, 240]
const LEVEL_TONE: Record<LogLevel, string> = {
  error: 'text-danger',
  warn: 'text-warning',
  info: 'text-brand',
  debug: 'text-warning',
}

export function LogLevelSection() {
  const [state, setState] = useState<LogLevelState | null>(null)
  const [draft, setDraft] = useState<LogLevel>('info')
  const [ttl, setTtl] = useState(60)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [remaining, setRemaining] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/troubleshooting/log-level')
    if (!res.ok) {
      setError('Failed to load log level')
      return
    }
    const data: LogLevelState = await res.json()
    setState(data)
    setDraft(data.configuredLevel)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Live countdown to the auto-revert deadline.
  useEffect(() => {
    if (!state?.expiresAt) {
      setRemaining(null)
      return
    }
    const tick = () => {
      const ms = new Date(state.expiresAt as string).getTime() - Date.now()
      if (ms <= 0) {
        setRemaining('reverting…')
        void load()
        return
      }
      const mins = Math.floor(ms / 60000)
      const secs = Math.floor((ms % 60000) / 1000)
      setRemaining(`${mins}m ${secs.toString().padStart(2, '0')}s`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [state?.expiresAt, load])

  async function apply() {
    setConfirming(false)
    setError(null)
    const res = await fetch('/api/admin/troubleshooting/log-level', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level: draft, ttlMinutes: draft === 'debug' ? ttl : undefined }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.message ?? 'Failed to set log level')
      return
    }
    setState(await res.json())
  }

  function attemptApply() {
    if (draft === 'debug') {
      setConfirming(true)
      return
    }
    void apply()
  }

  const debugActive = state?.effectiveLevel === 'debug'
  const dirty = state !== null && draft !== state.configuredLevel

  return (
    <ConsoleSection
      id="loglevel"
      icon={Gauge}
      title="Worker Log Level"
      description="Raise the ingestion worker's verbosity live. Debug auto-reverts to info so it can't be left on."
      headerAside={
        state && (
          <span
            className={`shrink-0 rounded-full bg-card px-3 py-1 text-xs font-semibold uppercase ${LEVEL_TONE[state.effectiveLevel]}`}
            data-testid="loglevel-current"
          >
            {state.effectiveLevel}
          </span>
        )
      }
    >
      {debugActive && (
        <div className="flex items-start gap-2 rounded-[10px] border border-warning bg-warning-soft p-3 text-xs text-warning" role="status">
          <AlertTriangle size={16} strokeWidth={1.5} className="mt-0.5 shrink-0" />
          <p>
            Debug logging is active{remaining ? <> — auto-reverts in <span className="font-semibold tabular-nums">{remaining}</span></> : ''}.
            Debug lines can include parsed-receipt data (merchants, amounts) and raise log cost.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-[12px] border border-line bg-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Level
            <select
              className="rounded-[8px] border border-line bg-card px-2 py-2 text-sm text-fg"
              value={draft}
              onChange={(e) => setDraft(e.target.value as LogLevel)}
              data-testid="loglevel-select"
            >
              {LEVELS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </label>

          {draft === 'debug' && (
            <label className="flex flex-col gap-1 text-xs text-muted">
              Auto-revert after
              <select
                className="rounded-[8px] border border-line bg-card px-2 py-2 text-sm text-fg"
                value={ttl}
                onChange={(e) => setTtl(Number(e.target.value))}
                data-testid="loglevel-ttl"
              >
                {TTL_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m} min</option>
                ))}
              </select>
            </label>
          )}

          <Button disabled={!dirty} onClick={attemptApply} data-testid="loglevel-apply">
            Apply
          </Button>
        </div>
        {error && <p className="text-xs text-danger" role="alert">{error}</p>}
      </div>

      <ConfirmDialog
        open={confirming}
        title="Enable debug logging?"
        body={`The ingestion worker will log debug detail (including parsed-receipt data) for ${ttl} minutes, then auto-revert to info. This raises log volume and cost.`}
        confirmLabel="Enable debug"
        onConfirm={apply}
        onCancel={() => setConfirming(false)}
      />
    </ConsoleSection>
  )
}
