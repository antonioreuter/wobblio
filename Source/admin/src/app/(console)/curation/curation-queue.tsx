'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, X, GitMerge, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface CurationItem {
  id: string
  name: string
  subtitle: string | null
  category: string | null
  aliases: string[]
  tenantCount: number
  observationCount: number
  quorum: number
  corroborationMet: boolean
  lastSeenOn: string | null
}

type Kind = 'merchants' | 'products'
type Sort = 'waiting' | 'name' | 'date'
interface CountryCount { countryCode: string; count: number }
interface RegionCount { regionCode: string; count: number }
interface CategoryCount { categoryId: string; categoryName: string; count: number }

interface Compatibility { categoryMatch: boolean; unitMatch: boolean; similarity: number }
interface PreviewRow { sourceId: string; compatibility: Compatibility | null; blockReason: string | null }
const BLOCK_LABEL: Record<string, string> = {
  category_mismatch: 'different category',
  unit_mismatch: 'different unit',
  low_similarity: 'too dissimilar',
  not_found: 'not found',
}

const PAGE_SIZES = [25, 50]

export function CurationQueue({ kind }: { kind: Kind }) {
  const [countries, setCountries] = useState<CountryCount[]>([])
  const [country, setCountry] = useState('')
  const [regions, setRegions] = useState<RegionCount[]>([])
  const [region, setRegion] = useState('')
  const [categories, setCategories] = useState<CategoryCount[]>([])
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState<Sort>('waiting')
  const [pageSize, setPageSize] = useState(25)

  const [items, setItems] = useState<CurationItem[]>([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState<{ id: string; action: 'reject' | 'merge' } | null>(null)
  const [mergeTarget, setMergeTarget] = useState('')
  const [showHelp, setShowHelp] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Product-only merge-group review: pick a canonical from the selection, drop faulty
  // members, then commit (the server skips any source the guard still refuses).
  const [groupOpen, setGroupOpen] = useState(false)
  const [groupTarget, setGroupTarget] = useState('')
  const [groupSources, setGroupSources] = useState<string[]>([])
  const [preview, setPreview] = useState<PreviewRow[] | null>(null)
  const [committing, setCommitting] = useState(false)

  const listEnabled = country !== ''
  const filtersKey = `${country}|${region}|${category}|${sort}|${pageSize}`

  // Mandatory country selector — only countries that have provisional items.
  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/admin/curation/${kind}/countries`)
      if (!res.ok) return setError('Failed to load countries')
      const data: { countries: CountryCount[] } = await res.json()
      setCountries(data.countries)
      setCountry(data.countries[0]?.countryCode ?? '')
    })()
  }, [kind])

  // On country change: load the pie (per-category counts) and the region options.
  useEffect(() => {
    setRegion('')
    setCategory('')
    setSelected(new Set())
    if (!country) {
      setCategories([])
      setRegions([])
      return
    }
    void (async () => {
      const [c, r] = await Promise.all([
        fetch(`/api/admin/curation/${kind}/categories?country=${country}`),
        fetch(`/api/admin/curation/${kind}/regions?country=${country}`),
      ])
      if (c.ok) setCategories((await c.json()).categories ?? [])
      if (r.ok) setRegions((await r.json()).regions ?? [])
    })()
  }, [kind, country])

  const loadPage = useCallback(async (off: number, replace: boolean) => {
    const params = new URLSearchParams({ country, sort, limit: String(pageSize), offset: String(off) })
    if (region) params.set('region', region)
    if (category) params.set('category', category)
    setLoading(true)
    const res = await fetch(`/api/admin/curation/${kind}?${params.toString()}`)
    setLoading(false)
    if (!res.ok) return setError('Failed to load queue')
    setError(null)
    const batch: CurationItem[] = (await res.json()).items ?? []
    setItems((prev) => (replace ? batch : [...prev, ...batch]))
    setOffset(off + batch.length)
    setHasMore(batch.length === pageSize)
  }, [kind, country, region, category, sort, pageSize])

  // Reset + load the first page whenever the filter set changes.
  useEffect(() => {
    setItems([])
    setOffset(0)
    setHasMore(false)
    if (listEnabled) void loadPage(0, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, listEnabled])

  // Infinite scroll: load the next page when the sentinel enters the viewport.
  const sentinel = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasMore) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loading) void loadPage(offset, false)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, loading, offset, loadPage])

  async function act(id: string, action: 'approve' | 'reject' | 'merge', body?: object) {
    setPending(null)
    setMergeTarget('')
    const res = await fetch(`/api/admin/curation/${kind}/${id}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    // A guarded merge can be refused (409 — different category/unit or too dissimilar);
    // keep the row in place and surface why instead of optimistically dropping it.
    if (!res.ok) {
      const reason = action === 'merge' ? ((await res.json().catch(() => ({}))).reason as string | undefined) : undefined
      setError(action === 'merge' ? `Merge refused${reason ? ` — ${BLOCK_LABEL[reason] ?? reason}` : ' (incompatible products)'}.` : 'Action failed.')
      return
    }
    setError(null)
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  async function batch(action: 'approve' | 'reject') {
    const ids = [...selected]
    await fetch(`/api/admin/curation/${kind}/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ids }),
    })
    setItems((prev) => prev.filter((it) => !selected.has(it.id)))
    setSelected(new Set())
  }

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const nameOf = useCallback((id: string) => items.find((it) => it.id === id)?.name ?? id, [items])

  function openMergeGroup() {
    const ids = [...selected]
    if (ids.length < 2) return
    setGroupSources(ids)
    setGroupTarget(ids[0])
    setPreview(null)
    setGroupOpen(true)
  }

  function closeMergeGroup() {
    setGroupOpen(false)
    setPreview(null)
    setGroupSources([])
    setGroupTarget('')
  }

  // Per-source compatibility against the chosen canonical, refreshed when the target or
  // the member set changes; the target itself is never a source of the merge.
  const sourceIds = groupSources.filter((id) => id !== groupTarget)
  const sourcesKey = `${groupTarget}|${sourceIds.join(',')}`
  useEffect(() => {
    if (!groupOpen || !groupTarget || sourceIds.length === 0) {
      setPreview([])
      return
    }
    void (async () => {
      const res = await fetch(`/api/admin/curation/products/merge-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId: groupTarget, sourceIds }),
      })
      if (!res.ok) return setError('Failed to preview merge')
      setPreview((await res.json()).sources ?? [])
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupOpen, sourcesKey])

  async function commitGroup() {
    setCommitting(true)
    const res = await fetch(`/api/admin/curation/products/merge-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId: groupTarget, sourceIds }),
    })
    setCommitting(false)
    if (!res.ok) return setError('Merge failed')
    const result: { applied: string[]; skipped: { id: string; reason: string }[] } = await res.json()
    const appliedSet = new Set(result.applied)
    setItems((prev) => prev.filter((it) => !appliedSet.has(it.id)))
    setSelected(new Set())
    setError(result.skipped.length > 0 ? `Merged ${result.applied.length}; skipped ${result.skipped.length} (incompatible).` : null)
    closeMergeGroup()
  }

  const allOnPageSelected = items.length > 0 && items.every((it) => selected.has(it.id))
  function togglePage() {
    setSelected((s) => {
      const next = new Set(s)
      if (allOnPageSelected) items.forEach((it) => next.delete(it.id))
      else items.forEach((it) => next.add(it.id))
      return next
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold text-fg">{kind === 'products' ? 'Product' : 'Merchant'} Curation</h1>
        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          aria-label="What do these actions do?"
          aria-expanded={showHelp}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted hover:bg-elevated hover:text-fg"
          data-testid="curation-help-toggle"
        >
          <Info size={16} strokeWidth={1.5} />
        </button>
        {selected.size > 0 && (
          <div className="ml-auto flex gap-2">
            {kind === 'products' && selected.size >= 2 && (
              <Button size="sm" variant="secondary" onClick={openMergeGroup} data-testid="curation-merge-group">
                <GitMerge size={12} strokeWidth={1.5} /> Merge group {selected.size}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => batch('approve')} data-testid="curation-batch-approve">
              Approve {selected.size}
            </Button>
            <Button size="sm" variant="destructive" onClick={() => batch('reject')} data-testid="curation-batch-reject">
              Reject {selected.size}
            </Button>
          </div>
        )}
      </div>

      {showHelp && (
        <div className="flex flex-col gap-1.5 rounded-[12px] border border-line bg-card p-4 text-xs text-muted" data-testid="curation-help">
          <p><span className="font-semibold text-success">Approve</span> — promote the provisional entity to ACTIVE; its held observations are released to the global serving catalog (once its counterpart is ACTIVE too).</p>
          <p><span className="font-semibold text-fg">Merge</span> — fold a provisional product into a canonical one (aliases &amp; observations move, source goes INACTIVE). Refused unless they share category + unit and are similar enough. Select 2+ products to build a reviewable merge group.</p>
          <p><span className="font-semibold text-danger">Reject</span> — set the entity INACTIVE and quarantine its observations so they leave the serving catalog.</p>
        </div>
      )}

      {/* Filters: country (mandatory) + region (optional) + sort + page size */}
      <div className="flex flex-wrap items-end gap-3 rounded-[12px] border border-line bg-card p-3">
        <Field label="Country *">
          <select className="rounded-[8px] border border-line bg-card px-2 py-1.5 text-sm text-fg" value={country} onChange={(e) => setCountry(e.target.value)} data-testid="curation-country">
            {countries.length === 0 && <option value="">— none —</option>}
            {countries.map((c) => (
              <option key={c.countryCode} value={c.countryCode}>{c.countryCode} ({c.count})</option>
            ))}
          </select>
        </Field>
        <Field label="Region">
          <select className="rounded-[8px] border border-line bg-card px-2 py-1.5 text-sm text-fg" value={region} onChange={(e) => setRegion(e.target.value)} data-testid="curation-region">
            <option value="">All regions</option>
            {regions.map((r) => (
              <option key={r.regionCode} value={r.regionCode}>{r.regionCode} ({r.count})</option>
            ))}
          </select>
        </Field>
        <Field label="Category">
          <select className="rounded-[8px] border border-line bg-card px-2 py-1.5 text-sm text-fg" value={category} onChange={(e) => setCategory(e.target.value)} data-testid="curation-category">
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.categoryId} value={c.categoryId}>{c.categoryName} ({c.count})</option>
            ))}
          </select>
        </Field>
        <Field label="Sort by">
          <select className="rounded-[8px] border border-line bg-card px-2 py-1.5 text-sm text-fg" value={sort} onChange={(e) => setSort(e.target.value as Sort)} data-testid="curation-sort">
            <option value="waiting">Most waiting</option>
            <option value="name">Name A–Z</option>
            <option value="date">Newest seen</option>
          </select>
        </Field>
        <Field label="Per page">
          <select className="rounded-[8px] border border-line bg-card px-2 py-1.5 text-sm text-fg" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} data-testid="curation-page-size">
            {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </div>

      {error && <p className="text-xs text-danger" role="alert">{error}</p>}

      {groupOpen && (
        <div className="flex flex-col gap-3 rounded-[12px] border border-line bg-card p-4" data-testid="curation-merge-group-panel">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-fg">Merge group review</p>
            <span className="text-xs text-muted">pick the canonical product; the rest fold into it</span>
            <button type="button" className="ml-auto text-muted hover:text-fg" onClick={closeMergeGroup} aria-label="Close merge group">
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>
          <ul className="flex flex-col gap-1.5" data-testid="curation-merge-group-list">
            {groupSources.map((id) => {
              const isTarget = id === groupTarget
              const row = preview?.find((p) => p.sourceId === id)
              const blocked = !isTarget && row?.blockReason
              return (
                <li key={id} className="flex flex-wrap items-center gap-2 rounded-[8px] border border-line px-3 py-2 text-sm" data-testid={`curation-merge-group-row-${id}`}>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="merge-canonical"
                      checked={isTarget}
                      onChange={() => setGroupTarget(id)}
                      aria-label={`Make ${nameOf(id)} canonical`}
                    />
                    <span className="font-medium text-fg">{nameOf(id)}</span>
                  </label>
                  {isTarget ? (
                    <span className="rounded bg-elevated px-1.5 py-0.5 text-[10px] font-semibold text-fg">CANONICAL</span>
                  ) : row?.compatibility ? (
                    <span className={blocked ? 'text-danger' : 'text-success'}>
                      {blocked ? `blocked — ${BLOCK_LABEL[row.blockReason!] ?? row.blockReason}` : 'compatible'}
                      {' · '}sim {row.compatibility.similarity.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-muted">…</span>
                  )}
                  <button
                    type="button"
                    className="ml-auto text-xs text-muted hover:text-danger"
                    onClick={() => setGroupSources((s) => s.filter((x) => x !== id))}
                    data-testid={`curation-merge-group-remove-${id}`}
                  >
                    remove
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              disabled={committing || sourceIds.length === 0 || (preview?.every((p) => p.blockReason) ?? false)}
              onClick={commitGroup}
              data-testid="curation-merge-group-commit"
            >
              {committing ? 'Merging…' : 'Commit merge'}
            </Button>
            <Button size="sm" variant="ghost" onClick={closeMergeGroup}>Cancel</Button>
            <span className="text-xs text-muted">incompatible members are skipped automatically</span>
          </div>
        </div>
      )}

      {!country ? (
        <Empty>No provisional {kind} awaiting review.</Empty>
      ) : items.length === 0 && !loading ? (
        <Empty>No provisional {kind} for this selection.</Empty>
      ) : (
        <>
          <label className="flex items-center gap-2 px-1 text-xs text-muted">
            <input type="checkbox" checked={allOnPageSelected} onChange={togglePage} aria-label="Select all loaded" data-testid="curation-select-page" />
            Select all loaded ({items.length})
          </label>

          <ul className="flex flex-col gap-2" data-testid="curation-list">
            {items.map((it) => (
              <li key={it.id} className="rounded-[12px] border border-line bg-card p-3" data-testid="curation-row">
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
                    <p className="font-medium text-fg">
                      {it.name} {it.subtitle && <span className="text-xs text-muted">· {it.subtitle}</span>}
                      {it.category && <span className="ml-2 rounded bg-elevated px-1.5 py-0.5 text-[10px] font-medium text-muted">{it.category}</span>}
                    </p>
                    <p className="text-xs text-muted">aliases: {it.aliases.join(', ') || '—'}</p>
                    <p className="text-xs text-muted">
                      <span className="tabular-nums">{it.tenantCount}</span> tenants ·{' '}
                      <span className={it.corroborationMet ? 'text-success' : 'text-warning'}>
                        {it.observationCount}/{it.quorum} corroboration
                      </span>
                      {it.lastSeenOn && <> · last seen {it.lastSeenOn}</>}
                    </p>
                  </div>
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => act(it.id, 'approve')} data-testid={`curation-approve-${it.id}`}>
                      <Check size={12} strokeWidth={1.5} /> Approve
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setPending({ id: it.id, action: 'merge' })} data-testid={`curation-merge-${it.id}`}>
                      <GitMerge size={12} strokeWidth={1.5} /> Merge
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setPending({ id: it.id, action: 'reject' })} data-testid={`curation-reject-${it.id}`}>
                      <X size={12} strokeWidth={1.5} /> Reject
                    </Button>
                  </div>
                </div>

                {pending?.id === it.id && pending.action === 'merge' && (
                  <div className="mt-3 flex items-end gap-2">
                    <input
                      className="h-9 flex-1 rounded-[8px] border border-line px-3 text-sm"
                      placeholder="Target entity id to merge into"
                      value={mergeTarget}
                      onChange={(e) => setMergeTarget(e.target.value)}
                      data-testid="curation-merge-target"
                    />
                    <Button size="sm" disabled={!mergeTarget.trim()} onClick={() => act(it.id, 'merge', { targetId: mergeTarget.trim() })}>
                      Confirm merge
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>

          <div ref={sentinel} className="h-8" />
          {loading && <p className="text-center text-xs text-muted">Loading…</p>}
          {!hasMore && items.length > 0 && <p className="text-center text-xs text-faint">End of queue.</p>}
        </>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted">
      {label}
      {children}
    </label>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[12px] border border-dashed border-line bg-card p-16 text-center text-sm text-muted">
      {children}
    </div>
  )
}
