'use client'

import { useCallback, useEffect, useState } from 'react'
import { Save, Cpu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ConsoleSection } from '@/components/ui/console-section'

interface ModelOption {
  id: string
  label: string
}

interface ModelEntry {
  role: string
  modelId: string | null
  options: ModelOption[]
}

const CUSTOM = '__custom__'

interface AuditRow {
  id: string
  actorEmail: string
  target: string
  before: unknown
  after: unknown
  createdAt: string
}

const SWAP_WARNING =
  'Changing this model will affect all new ingestions. The DOWN-ratio alarm is the canary for a bad swap — monitor it for 30 minutes after swapping.'

export function ModelsSection() {
  const [models, setModels] = useState<ModelEntry[]>([])
  const [history, setHistory] = useState<AuditRow[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [custom, setCustom] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [m, h] = await Promise.all([
      fetch('/api/admin/models'),
      fetch('/api/admin/models/history'),
    ])
    if (m.ok) setModels((await m.json()).models ?? [])
    else setError('Failed to load models')
    if (h.ok) setHistory((await h.json()).history ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function swap(role: string) {
    setPending(null)
    setError(null)
    setNotice(null)
    const modelId = drafts[role] ?? ''
    const res = await fetch(`/api/admin/models/${role}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelId }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(`${role}: ${data.message ?? 'swap failed'}`)
      return
    }
    setNotice(`Swapped ${role}.`)
    setDrafts((d) => ({ ...d, [role]: '' }))
    setCustom((s) => {
      const next = new Set(s)
      next.delete(role)
      return next
    })
    await load()
  }

  return (
    <ConsoleSection
      id="models"
      icon={Cpu}
      title="Model Matrix"
      description="Live Bedrock model routing per role. Swaps are audited and apply to new ingestions only."
    >
      {notice && <p className="text-xs text-success" data-testid="models-notice">{notice}</p>}
      {error && <p className="text-xs text-danger" role="alert">{error}</p>}

      <div className="overflow-x-auto rounded-[12px] border border-line bg-card">
        <table className="w-full min-w-[640px] text-sm" data-testid="models-table">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="p-3 font-medium">Role</th>
              <th className="p-3 font-medium">Current ID</th>
              <th className="p-3 font-medium">New ID</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {models.map((m) => (
              <tr key={m.role} className="border-b border-line last:border-0" data-testid="models-row">
                <td className="p-3 font-medium text-fg">{m.role}</td>
                <td className="p-3 font-mono text-xs text-muted">{m.modelId ?? '— unset —'}</td>
                <td className="p-3">
                  <div className="flex flex-col gap-2">
                    <select
                      aria-label={`New ${m.role} model`}
                      className="w-full rounded-[8px] border border-line bg-card px-2 py-2 text-sm text-fg"
                      value={custom.has(m.role) ? CUSTOM : drafts[m.role] ?? ''}
                      onChange={(e) => {
                        const v = e.target.value
                        setCustom((s) => {
                          const next = new Set(s)
                          if (v === CUSTOM) next.add(m.role)
                          else next.delete(m.role)
                          return next
                        })
                        setDrafts((d) => ({ ...d, [m.role]: v === CUSTOM ? '' : v }))
                      }}
                      data-testid={`models-select-${m.role}`}
                    >
                      <option value="">Choose a model…</option>
                      {m.options.map((o) => (
                        <option key={o.id} value={o.id}>{o.label}</option>
                      ))}
                      <option value={CUSTOM}>Custom…</option>
                    </select>
                    {custom.has(m.role) && (
                      <Input
                        aria-label={`Custom ${m.role} id`}
                        placeholder="enter Bedrock model id"
                        value={drafts[m.role] ?? ''}
                        onChange={(e) => setDrafts((d) => ({ ...d, [m.role]: e.target.value }))}
                        data-testid={`models-input-${m.role}`}
                      />
                    )}
                  </div>
                </td>
                <td className="p-3 text-right">
                  <Button
                    size="sm"
                    disabled={!(drafts[m.role] ?? '').trim()}
                    onClick={() => setPending(m.role)}
                    data-testid={`models-swap-${m.role}`}
                  >
                    <Save size={12} strokeWidth={1.5} /> Swap
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-fg">Swap history</h3>
        {history.length === 0 ? (
          <p className="text-xs text-muted">No swaps recorded.</p>
        ) : (
          <ul className="flex flex-col gap-1" data-testid="models-history">
            {history.map((h) => (
              <li key={h.id} className="rounded-[8px] border border-line bg-card p-2 text-xs">
                <span className="font-medium text-fg">{h.target}</span>{' '}
                <span className="font-mono text-muted">
                  {String(h.before ?? '∅')} → {String(h.after ?? '∅')}
                </span>{' '}
                <span className="text-faint">
                  · {h.actorEmail} · {new Date(h.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={`Swap ${pending} model?`}
        body={SWAP_WARNING}
        confirmLabel="Swap"
        onConfirm={() => pending && swap(pending)}
        onCancel={() => setPending(null)}
      />
    </ConsoleSection>
  )
}
