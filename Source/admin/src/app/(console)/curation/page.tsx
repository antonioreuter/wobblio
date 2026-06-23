'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, X, GitMerge } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface CurationItem {
  id: string
  name: string
  subtitle: string | null
  aliases: string[]
  tenantCount: number
  observationCount: number
  quorum: number
  corroborationMet: boolean
}

type Kind = 'merchants' | 'products'
interface Pending {
  kind: Kind
  id: string
  action: 'reject' | 'merge'
}

export default function CurationPage() {
  const [kind, setKind] = useState<Kind>('merchants')
  const [items, setItems] = useState<CurationItem[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState<Pending | null>(null)
  const [mergeTarget, setMergeTarget] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setSelected(new Set())
    const res = await fetch(`/api/admin/curation/${kind}`)
    if (!res.ok) {
      setError('Failed to load queue')
      return
    }
    setItems((await res.json()).items ?? [])
  }, [kind])

  useEffect(() => {
    void load()
  }, [load])

  async function act(id: string, action: 'approve' | 'reject' | 'merge', body?: object) {
    setPending(null)
    setMergeTarget('')
    await fetch(`/api/admin/curation/${kind}/${id}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    await load()
  }

  async function batch(action: 'approve' | 'reject') {
    await fetch(`/api/admin/curation/${kind.slice(0, -1)}s/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ids: [...selected] }),
    })
    await load()
  }

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-[#0f172a]">Alias Curation</h1>

      <div className="flex flex-wrap items-center gap-2" role="tablist">
        {(['merchants', 'products'] as Kind[]).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={kind === k}
            onClick={() => setKind(k)}
            className={`rounded-[8px] px-3 py-1.5 text-sm font-medium ${
              kind === k ? 'bg-[#0d9488] text-white' : 'bg-white text-[#64748b] border border-[#e2e8f0]'
            }`}
            data-testid={`curation-tab-${k}`}
          >
            {k[0].toUpperCase() + k.slice(1)}
          </button>
        ))}
        {selected.size > 0 && (
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={() => batch('approve')} data-testid="curation-batch-approve">
              Approve {selected.size}
            </Button>
            <Button size="sm" variant="destructive" onClick={() => batch('reject')} data-testid="curation-batch-reject">
              Reject {selected.size}
            </Button>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-[#dc2626]" role="alert">{error}</p>}

      {items.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-[#e2e8f0] bg-white p-16 text-center text-sm text-[#64748b]">
          No provisional {kind} awaiting review.
        </div>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="curation-list">
          {items.map((it) => (
            <li key={it.id} className="rounded-[12px] border border-[#e2e8f0] bg-white p-3" data-testid="curation-row">
              <div className="flex flex-wrap items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.has(it.id)}
                  onChange={() => toggle(it.id)}
                  aria-label={`Select ${it.name}`}
                  data-testid={`curation-select-${it.id}`}
                />
                <div className="flex flex-col gap-1">
                  <p className="font-medium text-[#0f172a]">
                    {it.name} {it.subtitle && <span className="text-xs text-[#64748b]">· {it.subtitle}</span>}
                  </p>
                  <p className="text-xs text-[#64748b]">aliases: {it.aliases.join(', ') || '—'}</p>
                  <p className="text-xs text-[#64748b]">
                    <span className="tabular-nums">{it.tenantCount}</span> tenants ·{' '}
                    <span className={it.corroborationMet ? 'text-[#16a34a]' : 'text-[#d97706]'}>
                      {it.observationCount}/{it.quorum} corroboration
                    </span>
                  </p>
                </div>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => act(it.id, 'approve')} data-testid={`curation-approve-${it.id}`}>
                    <Check size={12} strokeWidth={1.5} /> Approve
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setPending({ kind, id: it.id, action: 'merge' })} data-testid={`curation-merge-${it.id}`}>
                    <GitMerge size={12} strokeWidth={1.5} /> Merge
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setPending({ kind, id: it.id, action: 'reject' })} data-testid={`curation-reject-${it.id}`}>
                    <X size={12} strokeWidth={1.5} /> Reject
                  </Button>
                </div>
              </div>

              {pending?.id === it.id && pending.action === 'merge' && (
                <div className="mt-3 flex items-end gap-2">
                  <input
                    className="h-9 flex-1 rounded-[8px] border border-[#e2e8f0] px-3 text-sm"
                    placeholder="Target entity id to merge into"
                    value={mergeTarget}
                    onChange={(e) => setMergeTarget(e.target.value)}
                    data-testid="curation-merge-target"
                  />
                  <Button size="sm" disabled={!mergeTarget.trim()} onClick={() => act(it.id, 'merge', { targetId: mergeTarget.trim() })}>
                    Confirm merge
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPending(null)}>
                    Cancel
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pending?.action === 'reject'}
        title="Reject this entity?"
        body="It will be set INACTIVE and removed from the serving catalog. This can be reversed by an operator."
        confirmLabel="Reject"
        destructive
        onConfirm={() => pending && act(pending.id, 'reject')}
        onCancel={() => setPending(null)}
      />
    </div>
  )
}
