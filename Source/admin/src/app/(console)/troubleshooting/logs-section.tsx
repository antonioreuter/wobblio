'use client'

import { useCallback, useEffect, useState } from 'react'
import { ScrollText, RefreshCw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConsoleSection } from '@/components/ui/console-section'

type LogLevel = 'error' | 'warn' | 'info' | 'debug'

interface LogEvent {
  timestamp: string
  level: LogLevel
  message: string
  requestId: string | null
  raw: string
}

const LEVELS: LogLevel[] = ['error', 'warn', 'info', 'debug']
const WINDOWS = [15, 30, 60, 180, 720]
const REFRESH_MS = 10000

const LEVEL_BADGE: Record<LogLevel, string> = {
  error: 'bg-danger-soft text-danger',
  warn: 'bg-warning-soft text-warning',
  info: 'bg-brand-soft text-brand',
  debug: 'bg-elevated text-muted',
}

export function LogsSection() {
  const [events, setEvents] = useState<LogEvent[]>([])
  const [level, setLevel] = useState<LogLevel>('error')
  const [minutes, setMinutes] = useState(60)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [auto, setAuto] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ level, minutes: String(minutes), limit: '100' })
    if (search.trim()) params.set('search', search.trim())
    const res = await fetch(`/api/admin/troubleshooting/logs?${params.toString()}`)
    setLoading(false)
    if (!res.ok) {
      setError('Failed to load logs')
      return
    }
    setError(null)
    setEvents((await res.json()).events ?? [])
  }, [level, minutes, search])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!auto) return
    const id = setInterval(() => void load(), REFRESH_MS)
    return () => clearInterval(id)
  }, [auto, load])

  return (
    <ConsoleSection
      id="logs"
      icon={ScrollText}
      title="Ingestion Logs"
      description="Recent log lines from the invoice-processing worker, filtered by level, window, and text."
      headerAside={
        <button
          type="button"
          onClick={() => setAuto((a) => !a)}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${auto ? 'border-brand text-brand' : 'border-line text-muted hover:text-fg'}`}
          data-testid="logs-autorefresh"
        >
          <RefreshCw size={12} strokeWidth={1.5} />
          {auto ? 'Live' : 'Paused'}
        </button>
      }
    >
      <div className="flex flex-wrap items-end gap-3 rounded-[12px] border border-line bg-card p-3">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Min level
          <select
            className="rounded-[8px] border border-line bg-card px-2 py-1.5 text-sm text-fg"
            value={level}
            onChange={(e) => setLevel(e.target.value as LogLevel)}
            data-testid="logs-level"
          >
            {LEVELS.map((l) => (
              <option key={l} value={l}>{l}+</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Window
          <select
            className="rounded-[8px] border border-line bg-card px-2 py-1.5 text-sm text-fg"
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            data-testid="logs-window"
          >
            {WINDOWS.map((m) => (
              <option key={m} value={m}>{m < 60 ? `${m}m` : `${m / 60}h`}</option>
            ))}
          </select>
        </label>
        <div className="flex flex-1 flex-col gap-1 text-xs text-muted">
          Search
          <div className="flex items-center gap-2">
            <Input
              placeholder="invoice id, tenant, text…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void load()}
              data-testid="logs-search"
            />
            <Button variant="secondary" size="sm" onClick={load} data-testid="logs-refresh">
              <Search size={14} strokeWidth={1.5} /> Query
            </Button>
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-danger" role="alert">{error}</p>}

      {events.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-line bg-card p-12 text-center text-sm text-muted">
          {loading ? 'Loading…' : 'No matching log lines in this window.'}
        </div>
      ) : (
        <ul className="flex flex-col gap-1 font-mono text-xs" data-testid="logs-list">
          {events.map((ev, i) => (
            <li key={`${ev.timestamp}-${i}`} className="rounded-[8px] border border-line bg-card">
              <button
                type="button"
                onClick={() => setExpanded(expanded === i ? null : i)}
                className="flex w-full items-start gap-2 p-2 text-left hover:bg-elevated"
                data-testid="logs-row"
              >
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${LEVEL_BADGE[ev.level]}`}>
                  {ev.level}
                </span>
                <span className="shrink-0 text-faint">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                <span className="flex-1 truncate text-fg">{ev.message}</span>
              </button>
              {expanded === i && (
                <pre className="overflow-x-auto border-t border-line bg-bg p-2 text-fg">{prettify(ev.raw)}</pre>
              )}
            </li>
          ))}
        </ul>
      )}
    </ConsoleSection>
  )
}

function prettify(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}
