'use client'

import { useCallback, useEffect, useState } from 'react'
import { Workflow, History, AlertTriangle } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ConsoleSection } from '@/components/ui/console-section'

interface FeatureFlag {
  feature: string
  label: string
  enabled: boolean
}

interface AuditRow {
  id: string
  actorEmail: string
  target: string
  before: unknown
  after: unknown
  createdAt: string
}

interface PendingToggle {
  flag: FeatureFlag
  next: boolean
}

const onOff = (v: unknown): string => (v === true || v === 'true' || v === '1' ? 'ON' : 'OFF')

export function PipelineTogglesSection() {
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [audits, setAudits] = useState<AuditRow[]>([])
  const [pending, setPending] = useState<PendingToggle | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [featuresRes, auditRes] = await Promise.all([
      fetch('/api/admin/features'),
      fetch('/api/admin/features/audit'),
    ])
    if (!featuresRes.ok) {
      setError('Failed to load feature flags')
      return
    }
    setFlags((await featuresRes.json()).features ?? [])
    if (auditRes.ok) setAudits((await auditRes.json()).audits ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function apply(toggle: PendingToggle) {
    setPending(null)
    const res = await fetch('/api/admin/features/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feature: toggle.flag.feature, value: toggle.next }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(`${toggle.flag.label}: ${data.message ?? 'toggle failed'}`)
      return
    }
    setNotice(`${toggle.flag.label} is now ${toggle.next ? 'ON' : 'OFF'}.`)
    await load()
  }

  function request(flag: FeatureFlag) {
    setError(null)
    setNotice(null)
    setPending({ flag, next: !flag.enabled })
  }

  return (
    <ConsoleSection
      id="toggles"
      icon={Workflow}
      title="Pipeline Toggles"
      description="Global ingestion feature flags. Routing reads them from a cache, so a change takes effect within ~5 minutes."
    >
      <div
        className="flex items-start gap-3 rounded-[12px] border border-warning/30 bg-warning-soft px-4 py-3"
        data-testid="canary-alert"
      >
        <AlertTriangle size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-warning" />
        <div className="text-sm text-warning">
          <p className="font-medium">Canary guidance</p>
          <p className="mt-1 text-xs opacity-90">
            After any toggle, watch the DOWN-ratio and processing-latency KPIs for ~30 minutes
            before walking away. Routing flips within the cache TTL (~5 min), not instantly. Roll
            back here if either metric degrades.
          </p>
        </div>
      </div>

      {notice && <p className="text-xs text-success" data-testid="toggle-notice">{notice}</p>}
      {error && <p className="text-xs text-danger" role="alert">{error}</p>}

      <div className="flex flex-col gap-2">
        {flags.map((flag) => (
          <div
            key={flag.feature}
            className="flex items-center justify-between rounded-[12px] border border-line bg-card p-4"
            data-testid="feature-row"
          >
            <div className="flex flex-col gap-0.5">
              <p className="font-medium text-fg">{flag.label}</p>
              <p className="font-mono text-xs text-muted">{flag.feature}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs font-semibold ${flag.enabled ? 'text-success' : 'text-muted'}`}>
                {flag.enabled ? 'Agentic' : 'Legacy'}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={flag.enabled}
                aria-label={flag.label}
                onClick={() => request(flag)}
                className={`inline-flex h-7 w-12 items-center rounded-full border px-0.5 transition-colors ${
                  flag.enabled ? 'border-success bg-success' : 'border-line bg-elevated'
                }`}
                data-testid={`feature-toggle-${flag.feature}`}
              >
                <span
                  className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                    flag.enabled ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-fg">
        <History size={16} strokeWidth={1.5} className="text-muted" />
        Toggle history
      </div>
      <ul className="flex flex-col gap-2" data-testid="feature-audit-log">
        {audits.length === 0 && <li className="text-xs text-muted">No toggles yet.</li>}
        {audits.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-center gap-2 rounded-[12px] border border-line bg-card p-3 text-sm"
            data-testid="feature-audit-row"
          >
            <span className="text-xs text-muted">{new Date(row.createdAt).toLocaleString()}</span>
            <span className="text-xs text-muted">{row.actorEmail}</span>
            <span className="font-mono text-xs text-fg">{row.target}</span>
            <span className="text-xs text-muted">
              {onOff(row.before)} → <span className="font-medium text-fg">{onOff(row.after)}</span>
            </span>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={pending !== null}
        title={pending?.next ? 'Switch to the agentic pipeline?' : 'Switch back to the legacy pipeline?'}
        body={
          pending
            ? `${pending.flag.label} routes live ingestion traffic. The change takes effect within the routing cache TTL (~5 min). Watch the canary KPIs after confirming.`
            : ''
        }
        confirmLabel={pending?.next ? 'Enable agentic' : 'Revert to legacy'}
        onConfirm={() => pending && apply(pending)}
        onCancel={() => setPending(null)}
      />
    </ConsoleSection>
  )
}
