'use client'

import { useCallback, useEffect, useState } from 'react'
import { Users, ArrowDownToLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ConsoleSection } from '@/components/ui/console-section'

interface Overview {
  freeUsers: number
  cap: number
  queueSize: number
}

// Utilization → semantic colour: green under 85%, amber approaching the cap, red
// once the free tier is full (waitlist actively shedding load, §2.5).
function utilizationTone(ratio: number): { bar: string; text: string; label: string } {
  if (ratio >= 1) return { bar: 'bg-danger', text: 'text-danger', label: 'At capacity' }
  if (ratio >= 0.85) return { bar: 'bg-warning', text: 'text-warning', label: 'Near capacity' }
  return { bar: 'bg-success', text: 'text-success', label: 'Healthy' }
}

export function WaitlistSection() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [count, setCount] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/waitlist')
    if (!res.ok) {
      setError('Failed to load waitlist')
      return
    }
    setOverview(await res.json())
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function release() {
    setConfirming(false)
    setError(null)
    setMessage(null)
    const res = await fetch('/api/admin/waitlist/release', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: Number(count) }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.message ?? 'Release failed')
      return
    }
    setMessage(`Released ${data.released} user(s).`)
    setCount('')
    await load()
  }

  const cap = overview?.cap ?? 0
  const freeUsers = overview?.freeUsers ?? 0
  const queueSize = overview?.queueSize ?? 0
  const headroom = Math.max(0, cap - freeUsers)
  const ratio = cap > 0 ? freeUsers / cap : 0
  const tone = utilizationTone(ratio)

  const n = Number(count)
  const canRelease = Number.isInteger(n) && n > 0
  const overHeadroom = canRelease && n > headroom

  return (
    <ConsoleSection
      id="waitlist"
      icon={Users}
      title="Waitlist"
      description="Free-tier capacity and FIFO release. The cap is the load-shedding guardrail (§2.5)."
      headerAside={
        <span
          className={`hidden shrink-0 rounded-full bg-card px-3 py-1 text-xs font-semibold sm:inline ${tone.text}`}
          data-testid="waitlist-status-pill"
        >
          {tone.label}
        </span>
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        {/* Capacity gauge */}
        <div className="flex flex-col gap-4 rounded-[12px] border border-line bg-card p-5" data-testid="waitlist-overview">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Free-tier usage</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-fg">
                {freeUsers.toLocaleString()}
                <span className="text-base font-medium text-muted"> / {cap.toLocaleString()}</span>
              </p>
            </div>
            <p className={`text-2xl font-bold tabular-nums ${tone.text}`}>{Math.round(ratio * 100)}%</p>
          </div>

          <div className="h-2.5 w-full overflow-hidden rounded-full bg-elevated" role="progressbar" aria-valuenow={Math.round(ratio * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className={`h-full rounded-full transition-all ${tone.bar}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-line pt-3">
            <Metric label="Seats free" value={headroom} tone={headroom === 0 ? 'text-danger' : 'text-fg'} />
            <Metric label="In queue" value={queueSize} icon={<Users size={14} strokeWidth={1.5} />} />
          </div>
        </div>

        {/* Release control */}
        <div className="flex flex-col gap-3 rounded-[12px] border border-line bg-card p-5">
          <div className="flex items-center gap-2">
            <ArrowDownToLine size={16} strokeWidth={1.5} className="text-brand" />
            <p className="text-sm font-semibold text-fg">Release from queue</p>
          </div>
          <p className="text-xs text-muted">Activates from the front of the FIFO queue and emails each user.</p>
          <Input
            label="How many?"
            type="number"
            min={1}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            data-testid="waitlist-release-count"
          />
          {overHeadroom && (
            <p className="text-xs text-warning">Only {headroom} seat(s) free — raise the cap first or release fewer.</p>
          )}
          <Button
            disabled={!canRelease}
            onClick={() => setConfirming(true)}
            data-testid="waitlist-release-button"
          >
            Release {canRelease ? `${n} user(s)` : 'users'}
          </Button>
          <a href="#config" className="text-xs text-brand hover:underline">
            Raise the cap in SSM config ↓
          </a>
          {message && <p className="text-xs text-success" data-testid="waitlist-message">{message}</p>}
          {error && <p className="text-xs text-danger" role="alert">{error}</p>}
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Release waitlisted users?"
        body={`This activates up to ${count} user(s) from the front of the FIFO queue and emails them. Bounded by the current cap headroom.`}
        confirmLabel="Release"
        onConfirm={release}
        onCancel={() => setConfirming(false)}
      />
    </ConsoleSection>
  )
}

function Metric({ label, value, icon, tone = 'text-fg' }: { label: string; value: number; icon?: React.ReactNode; tone?: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-muted">
        {icon}
        {label}
      </div>
      <p className={`mt-0.5 text-lg font-bold tabular-nums ${tone}`}>{value.toLocaleString()}</p>
    </div>
  )
}
