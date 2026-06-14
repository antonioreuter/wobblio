'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Calendar,
  ChevronDown,
  Clock,
  RotateCw,
  Search,
  Shield,
  ShieldCheck,
  ShoppingCart,
  Trash2,
} from 'lucide-react'
import { Button, Card } from '@/components/ds'
import {
  ALL_TAGS,
  BLANK,
  CATEGORIES,
  daysAgo,
  FilterSelect,
  InvoiceTable,
  MERCHANTS,
  PAGE_SIZE,
  PRESETS,
  STATUSES,
  TODAY,
  useWorkspace,
  type FilterDraft,
  type Invoice,
  type Preset,
} from '@/components/workspace'

function matchesPreset(iso: string, draft: FilterDraft, rangeInvalid: boolean) {
  const d = new Date(iso)
  if (draft.preset === '30d') return d >= daysAgo(30)
  if (draft.preset === 'month')
    return d.getUTCMonth() === TODAY.getUTCMonth() && d.getUTCFullYear() === TODAY.getUTCFullYear()
  if (draft.preset === '90d') return d >= daysAgo(92)
  if (draft.preset === 'custom') {
    if (rangeInvalid || !draft.from || !draft.to) return true
    return d >= new Date(draft.from) && d <= new Date(draft.to)
  }
  return true
}

function filterInvoices(invoices: Invoice[], draft: FilterDraft, rangeInvalid: boolean) {
  return invoices.filter((inv) =>
    (draft.category === 'all' || inv.category === draft.category) &&
    (draft.merchant === 'all' || inv.merchant === draft.merchant) &&
    (draft.status === 'all' || inv.status[1] === draft.status) &&
    (draft.tags.length === 0 || draft.tags.some((t) => inv.tags.includes(t))) &&
    matchesPreset(inv.dateISO, draft, rangeInvalid),
  )
}

export default function InvoicesPage() {
  const { invoices, loading, setOpenInvoice, setConfirmDelete, setShareTarget } = useWorkspace()
  const [draft, setDraft] = useState<FilterDraft>(BLANK)
  const [searching, setSearching] = useState(false)
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [loadingMore, setLoadingMore] = useState(false)

  const set = (patch: Partial<FilterDraft>) => setDraft((d) => ({ ...d, ...patch }))
  const toggleTag = (t: string) =>
    setDraft((d) => ({ ...d, tags: d.tags.includes(t) ? d.tags.filter((x) => x !== t) : [...d.tags, t] }))

  const rangeDays = draft.from && draft.to
    ? Math.round((new Date(draft.to).getTime() - new Date(draft.from).getTime()) / 86_400_000)
    : 0
  const rangeInvalid =
    draft.preset === 'custom' && draft.from !== '' && draft.to !== '' && (rangeDays < 0 || rangeDays > 92)

  const filtered = useMemo(
    () => filterInvoices(invoices, draft, rangeInvalid),
    [invoices, draft, rangeInvalid],
  )

  useEffect(() => { setVisible(PAGE_SIZE) }, [draft])

  const shown = filtered.slice(0, visible)
  const remaining = filtered.length - shown.length

  const search = () => {
    setSearching(true)
    setTimeout(() => setSearching(false), 550)
  }

  const loadMore = () => {
    if (loadingMore) return
    setLoadingMore(true)
    setTimeout(() => {
      setVisible((v) => v + PAGE_SIZE)
      setLoadingMore(false)
    }, 500)
  }

  return (
    <div className="pane">
      <p className="pane-subtitle">View, filter and manage all your scanned receipts.</p>

      <Card className="panel filter-card">
        <div className="filter-head">
          <Search size={15} /> <span>Filter invoices</span>
        </div>
        <div className="filter-grid">
          <FilterSelect
            label="Expense category"
            icon={<Box size={15} />}
            value={draft.category}
            onChange={(e) => set({ category: e.target.value })}
          >
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </FilterSelect>
          <FilterSelect
            label="Merchant"
            icon={<ShoppingCart size={15} />}
            value={draft.merchant}
            onChange={(e) => set({ merchant: e.target.value })}
          >
            <option value="all">All merchants</option>
            {MERCHANTS.map((m) => <option key={m} value={m}>{m}</option>)}
          </FilterSelect>
          <FilterSelect
            label="Date range"
            icon={<Calendar size={15} />}
            value={draft.preset}
            onChange={(e) => set({ preset: e.target.value as Preset })}
          >
            {PRESETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </FilterSelect>
          <FilterSelect
            label="Status"
            icon={<Shield size={15} />}
            value={draft.status}
            onChange={(e) => set({ status: e.target.value })}
          >
            <option value="all">Any status</option>
            {STATUSES.map(([, l]) => <option key={l} value={l}>{l}</option>)}
          </FilterSelect>
        </div>

        {draft.preset === 'custom' && (
          <div className="filter-grid filter-dates">
            <div className="filter-field">
              <label className="filter-label">From</label>
              <div className="filter-wrap">
                <span className="lead-icon"><Calendar size={15} /></span>
                <input
                  type="date"
                  className="filter-select"
                  value={draft.from}
                  max={draft.to || undefined}
                  onChange={(e) => set({ from: e.target.value })}
                />
              </div>
            </div>
            <div className="filter-field">
              <label className="filter-label">To</label>
              <div className="filter-wrap">
                <span className="lead-icon"><Calendar size={15} /></span>
                <input
                  type="date"
                  className="filter-select"
                  value={draft.to}
                  min={draft.from || undefined}
                  onChange={(e) => set({ to: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}

        <div className="filter-field" style={{ marginTop: 16 }}>
          <label className="filter-label">Tags</label>
          <div className="filter-tags">
            {ALL_TAGS.map((t) => (
              <button
                key={t}
                type="button"
                className={`filter-chip ${draft.tags.includes(t) ? 'on' : ''}`}
                onClick={() => toggleTag(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-foot">
          <span className={`filter-hint ${rangeInvalid ? 'invalid' : ''}`}>
            <Clock size={13} />
            {rangeInvalid ? 'Range can’t exceed 3 months.' : 'Maximum range: 3 months.'}
          </span>
          <div className="filter-actions">
            <button
              type="button"
              className="btn btn--text"
              style={{ padding: '8px 14px' }}
              onClick={() => setDraft(BLANK)}
              data-testid="invoices-clear-filters"
            >
              <Trash2 size={14} /> Clear filters
            </button>
            <Button
              variant="primary"
              disabled={rangeInvalid}
              style={{ padding: '9px 20px', fontSize: 13 }}
              onClick={search}
              iconLeft={searching ? null : <Search size={15} />}
              data-testid="invoices-search"
            >
              {searching ? 'Searching…' : 'Search'}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="panel" style={{ padding: 0 }}>
        <div className="panel-header" style={{ padding: '20px 24px 0' }}>
          <span className="panel-title">
            All invoices <span className="count-pill">{filtered.length}</span>
          </span>
          <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
            Showing {shown.length} of {filtered.length}
          </span>
        </div>
        <InvoiceTable
          invoices={shown}
          loading={loading}
          skeletonRows={8}
          onOpen={setOpenInvoice}
          onRequestDelete={setConfirmDelete}
          onShare={setShareTarget}
        />
        {remaining > 0 && (
          <div className="load-more">
            <button
              type="button"
              className="load-more-btn"
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <>
                  <span className="spin" style={{ display: 'flex' }}>
                    <RotateCw size={14} />
                  </span>{' '}
                  Loading…
                </>
              ) : (
                <>
                  <ChevronDown size={15} /> Load {Math.min(PAGE_SIZE, remaining)} more
                </>
              )}
            </button>
          </div>
        )}
        <div className="table-foot">
          <ShieldCheck size={14} /> Your data is private and secure.
        </div>
      </Card>
    </div>
  )
}
