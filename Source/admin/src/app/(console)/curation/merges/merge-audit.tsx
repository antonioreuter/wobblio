'use client'

import { useCallback, useEffect, useState } from 'react'
import { GitMerge, ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface MergeAfter {
  targetId?: string
  movedAliasIds?: string[]
  movedObservationCount?: number
  similarity?: number
}
interface MergeRow {
  id: string
  actorEmail: string
  target: string // "product:<sourceId>"
  after: MergeAfter | null
  createdAt: string
}
interface AliasInfo {
  id: string
  aliasNormalized: string
  merchantId: string | null
  source: string
  matchCount: number
  lastSeenAt: string
}

const sourceOf = (target: string) => target.replace(/^product:/, '')

export function MergeAudit() {
  const [merges, setMerges] = useState<MergeRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openTarget, setOpenTarget] = useState<string | null>(null)
  const [aliases, setAliases] = useState<AliasInfo[] | null>(null)
  const [aliasesFor, setAliasesFor] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/admin/curation/merges')
      if (!res.ok) return setError('Failed to load merge history')
      setMerges((await res.json()).merges ?? [])
    })()
  }, [])

  const inspect = useCallback(async (targetId: string) => {
    if (openTarget === targetId) {
      setOpenTarget(null)
      return
    }
    setOpenTarget(targetId)
    setAliases(null)
    setAliasesFor(targetId)
    const res = await fetch(`/api/admin/curation/products/${targetId}/aliases`)
    if (!res.ok) return setError('Failed to load aliases')
    setAliases((await res.json()).aliases ?? [])
  }, [openTarget])

  async function deactivate(targetId: string, aliasId: string) {
    const res = await fetch(`/api/admin/curation/products/${targetId}/aliases/${aliasId}/deactivate`, { method: 'POST' })
    if (!res.ok) return setError('Failed to deactivate alias')
    setAliases((prev) => prev?.filter((a) => a.id !== aliasId) ?? prev)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-fg">Merge Audit</h1>
        <p className="text-sm text-muted">
          Past product merges. Inspect a target&apos;s aliases and deactivate any a bad merge left behind so receipts
          stop resolving onto it. Merges made before provenance tracking show no moved-id detail.
        </p>
      </div>

      {error && <p className="text-xs text-danger" role="alert">{error}</p>}

      {merges === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : merges.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-line bg-card p-16 text-center text-sm text-muted">
          No merges recorded yet.
        </div>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="merge-audit-list">
          {merges.map((m) => {
            const targetId = m.after?.targetId
            const open = openTarget === targetId
            return (
              <li key={m.id} className="rounded-[12px] border border-line bg-card p-3" data-testid="merge-audit-row">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <GitMerge size={14} strokeWidth={1.5} className="text-muted" />
                  <span className="font-mono text-xs text-muted">{sourceOf(m.target)}</span>
                  <span className="text-muted">→</span>
                  <span className="font-mono text-xs font-medium text-fg">{targetId ?? '—'}</span>
                  {typeof m.after?.similarity === 'number' && (
                    <span className="text-xs text-muted">· sim {m.after.similarity.toFixed(2)}</span>
                  )}
                  {typeof m.after?.movedObservationCount === 'number' && (
                    <span className="text-xs text-muted">· {m.after.movedObservationCount} obs moved</span>
                  )}
                  <span className="ml-auto text-xs text-faint">{m.createdAt} · {m.actorEmail}</span>
                  {targetId && (
                    <Button size="sm" variant="ghost" onClick={() => inspect(targetId)} data-testid={`merge-audit-inspect-${targetId}`}>
                      {open ? <ChevronDown size={12} strokeWidth={1.5} /> : <ChevronRight size={12} strokeWidth={1.5} />}
                      Aliases
                    </Button>
                  )}
                </div>

                {open && targetId && (
                  <div className="mt-3 border-t border-line pt-3">
                    {aliasesFor !== targetId || aliases === null ? (
                      <p className="text-xs text-muted">Loading aliases…</p>
                    ) : aliases.length === 0 ? (
                      <p className="text-xs text-muted">No aliases on this product.</p>
                    ) : (
                      <ul className="flex flex-col gap-1.5" data-testid="merge-audit-aliases">
                        {aliases.map((a) => (
                          <li key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="font-medium text-fg">{a.aliasNormalized}</span>
                            <span className="text-xs text-muted">{a.source} · {a.matchCount}× · last {a.lastSeenAt}</span>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="ml-auto"
                              onClick={() => deactivate(targetId, a.id)}
                              data-testid={`merge-audit-deactivate-${a.id}`}
                            >
                              <Trash2 size={12} strokeWidth={1.5} /> Deactivate
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
