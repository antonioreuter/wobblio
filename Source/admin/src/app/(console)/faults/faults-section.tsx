'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Wrench, Ban, AlertTriangle, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ConsoleSection } from '@/components/ui/console-section'

interface BlockedInvoice {
  invoiceId: string
  ownerId: string
  systemFaultReason: string
  blockedAt: string
}

interface FaultsView {
  invoices: BlockedInvoice[]
  thisWeekCount: number
  threshold: number
  overThreshold: boolean
}

export function FaultsSection() {
  const [view, setView] = useState<FaultsView | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmReprocess, setConfirmReprocess] = useState(false)
  const [pendingWontProcess, setPendingWontProcess] = useState<BlockedInvoice | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const res = await fetch('/api/admin/faults')
    if (!res.ok) {
      setError('Failed to load quarantined invoices')
      return
    }
    setView(await res.json())
    setSelected(new Set())
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function reprocess() {
    setConfirmReprocess(false)
    setBusy(true)
    try {
      const res = await fetch('/api/admin/faults/reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceIds: [...selected] }),
      })
      if (!res.ok) throw new Error(await res.text())
      await load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function wontProcess(invoiceId: string) {
    setPendingWontProcess(null)
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/faults/${invoiceId}/wont-process`, { method: 'POST' })
      if (!res.ok) throw new Error(await res.text())
      await load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const invoices = view?.invoices ?? []

  return (
    <ConsoleSection
      id="faults"
      icon={Wrench}
      title="System-Fault Invoices"
      description="Invoices held after an our-stack processing failure. Fix the root cause, then reprocess from the stored file — the user never re-uploads."
      headerAside={
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={load} data-testid="faults-refresh">
            <RefreshCw size={14} strokeWidth={1.5} /> Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={selected.size === 0 || busy}
            onClick={() => setConfirmReprocess(true)}
            data-testid="faults-reprocess-selected"
          >
            <RefreshCw size={14} strokeWidth={1.5} /> Reprocess {selected.size > 0 ? `(${selected.size})` : ''}
          </Button>
        </div>
      }
    >
      {error && <p className="text-xs text-danger" role="alert">{error}</p>}

      {view && (
        <div
          className={`flex items-center gap-2 rounded-[12px] border p-3 text-sm ${
            view.overThreshold
              ? 'border-danger/40 bg-danger-soft text-danger'
              : 'border-line bg-card text-muted'
          }`}
          data-testid="faults-alert"
        >
          {view.overThreshold ? <AlertTriangle size={16} strokeWidth={1.5} /> : <ShieldCheck size={16} strokeWidth={1.5} />}
          <span>
            {view.thisWeekCount} system fault{view.thisWeekCount === 1 ? '' : 's'} this week
            {' '}(threshold {view.threshold}){view.overThreshold ? ' — at/over threshold, investigate the root cause' : ''}.
          </span>
        </div>
      )}

      {invoices.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-line bg-card p-12 text-center text-sm text-muted">
          No quarantined invoices.
        </div>
      ) : (
        <ul className="mt-3 flex flex-col gap-2" role="list" data-testid="faults-list">
          {invoices.map((inv) => (
            <li key={inv.invoiceId} className="rounded-[12px] border border-line bg-card p-3" data-testid="faults-row">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selected.has(inv.invoiceId)}
                  onChange={() => toggle(inv.invoiceId)}
                  className="mt-1"
                  aria-label={`Select invoice ${inv.invoiceId}`}
                  data-testid={`faults-select-${inv.invoiceId}`}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-xs text-muted">{inv.invoiceId}</p>
                  <p className="text-xs text-muted">
                    owner {inv.ownerId} · blocked {new Date(inv.blockedAt).toLocaleString()}
                  </p>
                  <p className="mt-1 font-mono text-xs text-fg break-words">{inv.systemFaultReason}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => setPendingWontProcess(inv)}
                  data-testid={`faults-wont-process-${inv.invoiceId}`}
                >
                  <Ban size={12} strokeWidth={1.5} /> Won&apos;t process
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={confirmReprocess}
        title={`Reprocess ${selected.size} invoice${selected.size === 1 ? '' : 's'}?`}
        body="Re-runs the stored file through ingestion on the user's behalf. On success the user is charged the run's tokens (current week) and notified. A repeat fault re-quarantines it."
        confirmLabel="Reprocess"
        onConfirm={reprocess}
        onCancel={() => setConfirmReprocess(false)}
      />

      <ConfirmDialog
        open={pendingWontProcess !== null}
        title="Mark as won't-process?"
        body={
          pendingWontProcess
            ? `Closes ${pendingWontProcess.invoiceId} as a user-fault the owner can delete (no charge). Use when the image genuinely can't be processed.`
            : ''
        }
        confirmLabel="Won't process"
        destructive
        onConfirm={() => pendingWontProcess && wontProcess(pendingWontProcess.invoiceId)}
        onCancel={() => setPendingWontProcess(null)}
      />
    </ConsoleSection>
  )
}
