'use client'

import { useCallback, useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface ModelEntry {
  role: string
  modelId: string | null
}

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

export default function ModelsPage() {
  const [models, setModels] = useState<ModelEntry[]>([])
  const [history, setHistory] = useState<AuditRow[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
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
    await load()
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-[#0f172a]">Model-Swap Matrix</h1>

      {notice && <p className="text-xs text-[#16a34a]" data-testid="models-notice">{notice}</p>}
      {error && <p className="text-xs text-[#dc2626]" role="alert">{error}</p>}

      <div className="overflow-x-auto rounded-[12px] border border-[#e2e8f0] bg-white">
        <table className="w-full min-w-[640px] text-sm" data-testid="models-table">
          <thead>
            <tr className="border-b border-[#e2e8f0] text-left text-xs text-[#64748b]">
              <th className="p-3 font-medium">Role</th>
              <th className="p-3 font-medium">Current ID</th>
              <th className="p-3 font-medium">New ID</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {models.map((m) => (
              <tr key={m.role} className="border-b border-[#f1f5f9]" data-testid="models-row">
                <td className="p-3 font-medium text-[#0f172a]">{m.role}</td>
                <td className="p-3 font-mono text-xs text-[#64748b]">{m.modelId ?? '— unset —'}</td>
                <td className="p-3">
                  <Input
                    aria-label={`New ${m.role} id`}
                    placeholder="new model id"
                    value={drafts[m.role] ?? ''}
                    onChange={(e) => setDrafts((d) => ({ ...d, [m.role]: e.target.value }))}
                    data-testid={`models-input-${m.role}`}
                  />
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

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-[#0f172a]">Swap history</h2>
        {history.length === 0 ? (
          <p className="text-xs text-[#64748b]">No swaps recorded.</p>
        ) : (
          <ul className="flex flex-col gap-1" data-testid="models-history">
            {history.map((h) => (
              <li key={h.id} className="rounded-[8px] border border-[#e2e8f0] bg-white p-2 text-xs">
                <span className="font-medium text-[#0f172a]">{h.target}</span>{' '}
                <span className="font-mono text-[#64748b]">
                  {String(h.before ?? '∅')} → {String(h.after ?? '∅')}
                </span>{' '}
                <span className="text-[#94a3b8]">
                  · {h.actorEmail} · {new Date(h.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={pending !== null}
        title={`Swap ${pending} model?`}
        body={SWAP_WARNING}
        confirmLabel="Swap"
        onConfirm={() => pending && swap(pending)}
        onCancel={() => setPending(null)}
      />
    </div>
  )
}
