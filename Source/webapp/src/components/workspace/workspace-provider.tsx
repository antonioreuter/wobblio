'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { fmtMoney, type Invoice } from './invoice-data'
import { type Budget } from './budget-data'
import { InvoiceDrawer } from './invoice-drawer'
import { ConfirmDialog } from './confirm-dialog'
import { ShareDialog } from './share-dialog'
import { BillSplitDialog } from './bill-split-dialog'
import { WorkspaceToast, type ToastState, type ToastTone } from './workspace-toast'
import { mapInvoice, type BackendInvoice } from '@/lib/invoice-map'
import { uploadReceipt, UploadError } from '@/lib/upload-receipt'

async function fetchInvoices(): Promise<Invoice[]> {
  const res = await fetch('/api/invoices', { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to load invoices (${res.status})`)
  const data = (await res.json()) as { invoices: BackendInvoice[] }
  return data.invoices.map(mapInvoice)
}

/** Weekly credit quota for the current tenant (§2.4). */
export interface Usage {
  used: number
  /** null when unlimited (TESTER/ADMIN). */
  cap: number | null
  /** null when unlimited (TESTER/ADMIN). */
  remaining: number | null
  unlimited: boolean
}

async function fetchUsage(): Promise<Usage | null> {
  const res = await fetch('/api/me/usage', { cache: 'no-store' })
  if (!res.ok) return null
  return (await res.json()) as Usage
}

/** Highest summed-spend merchant for the current month (§dashboard). */
export interface TopMerchant {
  name: string
  total: number
}

async function fetchTopMerchants(): Promise<TopMerchant[]> {
  const res = await fetch('/api/me/stats/top-merchant', { cache: 'no-store' })
  if (!res.ok) return []
  const data = (await res.json()) as { merchants: TopMerchant[] }
  return data.merchants ?? []
}

async function fetchBudgets(): Promise<Budget[]> {
  const res = await fetch('/api/budgets', { cache: 'no-store' })
  if (!res.ok) return []
  const data = (await res.json()) as { budgets: Budget[] }
  return data.budgets
}

interface WorkspaceContextValue {
  invoices: Invoice[]
  usage: Usage | null
  topMerchants: TopMerchant[]
  budgets: Budget[]
  loading: boolean
  refreshing: boolean
  refresh: () => void
  refreshBudgets: () => Promise<void>
  removeInvoice: (id: string) => void
  openInvoice: Invoice | null
  setOpenInvoice: (inv: Invoice | null) => void
  setConfirmDelete: (inv: Invoice | null) => void
  setShareTarget: (inv: Invoice | null) => void
  setSplitTarget: (inv: Invoice | null) => void
  showToast: (msg: string, tone?: ToastTone) => void
  scanReceipt: () => void
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used inside <WorkspaceProvider>')
  return ctx
}

const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp'
// Some OS/browser file dialogs match by extension rather than MIME, so list both.
const PDF_ACCEPT = `${IMAGE_ACCEPT},application/pdf,.pdf`

// Poll-until-terminal (specs/fixes/07.02). Measured ingestion is p50 ~17.5s /
// p90 ~25s, so fixed post-upload timers miss nearly every invoice. While any
// row is PROCESSING, refetch on this ramp (held at the last interval) until
// every row is terminal. The ceiling (~3 min) only guards a stuck row — a
// manual refresh or new upload restarts the loop.
// TODO(specs/fixes/07.01): poll the lightweight GET /invoices/status?ids=
// endpoint per tick once the backend ships it, instead of the full list.
const POLL_RAMP_MS = [2500, 5000]
const POLL_HOLD_MS = 5000
const MAX_POLL_TICKS = 36

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

// Polling pauses while the tab is hidden and resumes (with an immediate tick)
// when it becomes visible again. Resolves early — and always detaches its
// listener — when `signal` aborts, so a superseded or unmounted poll parked here
// while the tab is hidden never leaks the visibilitychange listener.
const waitUntilVisible = (signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (!document.hidden || signal.aborted) {
      resolve()
      return
    }
    const cleanup = () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      signal.removeEventListener('abort', onAbort)
    }
    const onVisibilityChange = () => {
      if (document.hidden) return
      cleanup()
      resolve()
    }
    const onAbort = () => {
      cleanup()
      resolve()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    signal.addEventListener('abort', onAbort)
  })

// The toast for an invoice that just reached a terminal status, keyed on the raw
// backend status. DISCARDED (user-initiated) and any unmapped/future status
// return null — no toast rather than a wrong one.
function completionToast(inv: Invoice): { msg: string; tone: ToastTone } | null {
  switch (inv.rawStatus) {
    case 'PARSED':
    case 'NEEDS_REVIEW':
      return { msg: `Receipt ready — ${inv.merchant}, ${fmtMoney(inv.total, inv.currency)}.`, tone: 'success' }
    case 'SUSPECTED_DUPLICATE':
      return { msg: 'Looks like a duplicate — open it to confirm or remove it.', tone: 'success' }
    case 'FAILED_PROCESSING':
      return { msg: "We couldn't read your receipt — try a clearer, well-lit photo.", tone: 'danger' }
    default:
      return null
  }
}

export function WorkspaceProvider({
  children,
  pdfUploadEnabled = false,
  userRole,
}: {
  children: ReactNode
  pdfUploadEnabled?: boolean
  userRole?: string
}) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [usage, setUsage] = useState<Usage | null>(null)
  const [topMerchants, setTopMerchants] = useState<TopMerchant[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [openInvoice, setOpenInvoice] = useState<Invoice | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Invoice | null>(null)
  const [shareTarget, setShareTarget] = useState<Invoice | null>(null)
  const [splitTarget, setSplitTarget] = useState<Invoice | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadInvoices = useCallback(() => fetchInvoices().then(setInvoices), [])
  const loadUsage = useCallback(() => fetchUsage().then(setUsage), [])
  const loadTopMerchants = useCallback(() => fetchTopMerchants().then(setTopMerchants), [])
  const loadBudgets = useCallback(() => fetchBudgets().then(setBudgets), [])

  // Latest list for the poll loop's transition diff, without re-binding the loop.
  const invoicesRef = useRef<Invoice[]>([])
  useEffect(() => {
    invoicesRef.current = invoices
  }, [invoices])
  // Bumped whenever a newer poll run (or unmount) must supersede an in-flight one.
  const pollGen = useRef(0)

  useEffect(() => {
    loadInvoices().catch(() => undefined).finally(() => setLoading(false))
    loadUsage().catch(() => undefined)
    loadTopMerchants().catch(() => undefined)
    loadBudgets().catch(() => undefined)
  }, [loadInvoices, loadUsage, loadTopMerchants, loadBudgets])

  const showToast = useCallback((msg: string, tone: ToastTone = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, tone })
    const ms = tone === 'processing' ? 1600 : 6000
    toastTimer.current = setTimeout(() => setToast(null), ms)
  }, [])

  // A receipt just left PROCESSING: tell the user, and refresh what a finished
  // parse moves — credits charge at success, budgets at upload time. Batches are
  // almost always a single receipt, so one toast (for the first announceable one)
  // is enough. Branch on the raw backend status, never the display tone: an
  // unmapped/future status must not be mis-announced as a parse failure.
  const announceTerminal = useCallback(
    (finished: Invoice[]) => {
      void loadUsage().catch(() => undefined)
      void loadBudgets().catch(() => undefined)
      const announced = finished.map((inv) => completionToast(inv)).find((t) => t !== null)
      if (announced) showToast(announced.msg, announced.tone)
    },
    [loadUsage, loadBudgets, showToast],
  )

  // Keyed on the id-set so a tick that only changes row contents doesn't
  // re-ramp, while a new upload / terminal flip / manual refresh restarts the
  // loop with a fresh generation (the cleanup kills the stale one).
  const processingKey = invoices
    .filter((inv) => inv.isProcessing)
    .map((inv) => inv.id)
    .sort()
    .join(',')

  useEffect(() => {
    if (!processingKey) return
    const gen = ++pollGen.current
    const abort = new AbortController()
    const poll = async () => {
      for (let tick = 0; tick < MAX_POLL_TICKS; tick++) {
        await sleep(POLL_RAMP_MS[tick] ?? POLL_HOLD_MS)
        if (gen !== pollGen.current) return
        await waitUntilVisible(abort.signal)
        if (gen !== pollGen.current) return
        let next: Invoice[]
        try {
          next = await fetchInvoices()
        } catch {
          continue // keep the last good list; try again next tick
        }
        if (gen !== pollGen.current) return
        const wasProcessing = new Set(
          invoicesRef.current.filter((inv) => inv.isProcessing).map((inv) => inv.id),
        )
        const finished = next.filter((inv) => wasProcessing.has(inv.id) && !inv.isProcessing)
        setInvoices(next)
        if (finished.length > 0) announceTerminal(finished)
        if (!next.some((inv) => inv.isProcessing)) return
      }
      if (gen === pollGen.current) {
        showToast('Still working on your receipt — it will appear here as soon as it’s ready.', 'processing')
      }
    }
    void poll()
    return () => {
      pollGen.current++
      abort.abort() // wake a poll parked in waitUntilVisible so it detaches its listener
    }
  }, [processingKey, announceTerminal, showToast])

  const refresh = useCallback(() => {
    if (refreshing) return
    setRefreshing(true)
    loadUsage().catch(() => undefined)
    loadTopMerchants().catch(() => undefined)
    loadBudgets().catch(() => undefined)
    loadInvoices().catch(() => undefined).finally(() => setRefreshing(false))
  }, [refreshing, loadInvoices, loadUsage, loadTopMerchants, loadBudgets])

  const refreshBudgets = useCallback(() => loadBudgets().catch(() => undefined), [loadBudgets])

  const removeInvoice = useCallback((id: string) => {
    setInvoices((list) => list.filter((x) => x.id !== id))
  }, [])

  const doDelete = useCallback(async () => {
    if (!confirmDelete) return
    const inv = confirmDelete
    // Optimistic: drop the row and close the drawer/dialog right away, then
    // confirm with the backend and roll back from the server on failure.
    removeInvoice(inv.id)
    setOpenInvoice((curr) => (curr && curr.id === inv.id ? null : curr))
    setConfirmDelete(null)
    try {
      const res = await fetch(`/api/invoices/${inv.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(String(res.status))
      // Spend is computed live from non-DISCARDED invoices, so refetch budgets to
      // reflect the drop without a manual reload.
      void refreshBudgets()
      showToast(`${inv.merchant} invoice deleted.`, 'danger')
    } catch {
      void loadInvoices().catch(() => undefined)
      showToast(`Couldn’t delete the ${inv.merchant} invoice — please try again.`, 'danger')
    }
  }, [confirmDelete, removeInvoice, showToast, loadInvoices, refreshBudgets])

  const onLocationConfirmed = useCallback((status: 'RESOLVED' | 'HELD_UNMAPPED') => {
    setOpenInvoice(null)
    refresh()
    showToast(
      status === 'RESOLVED'
        ? 'Location confirmed — your prices now help the regional index.'
        : 'Location saved — it’ll join the index once we map your area.',
      'success',
    )
  }, [refresh, showToast])

  const copyLink = useCallback((link: string) => {
    try {
      void navigator.clipboard?.writeText(link)
    } catch {
      // ignore — toast still gives feedback
    }
    showToast('Link copied — paste it anywhere to share.', 'success')
  }, [showToast])

  const scanReceipt = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    // Offer PDF to everyone so non-premium users discover the feature; gate the actual
    // upload below with a clear upsell instead of silently hiding the option.
    input.accept = PDF_ACCEPT
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      if (!pdfUploadEnabled && file.type === 'application/pdf') {
        showToast('PDF uploads are a Premium feature — upgrade to scan PDF invoices.', 'danger')
        return
      }
      showToast('Uploading your receipt…', 'processing')
      try {
        await uploadReceipt(file)
        showToast('Receipt uploaded — reading it usually takes about 20 seconds.', 'processing')
        // Land the PROCESSING row + charged credits right away; the
        // poll-until-terminal effect takes over from there.
        void loadInvoices().catch(() => undefined)
        void loadUsage().catch(() => undefined)
      } catch (err) {
        const msg = err instanceof UploadError ? err.message : 'Upload failed — please try again.'
        showToast(msg, 'danger')
      }
    }
    input.click()
  }, [showToast, loadInvoices, loadUsage, pdfUploadEnabled])

  const value: WorkspaceContextValue = {
    invoices,
    usage,
    topMerchants,
    budgets,
    loading,
    refreshing,
    refresh,
    refreshBudgets,
    removeInvoice,
    openInvoice,
    setOpenInvoice,
    setConfirmDelete,
    setShareTarget,
    setSplitTarget,
    showToast,
    scanReceipt,
  }

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <WorkspaceToast
            toast={toast}
            onClose={() => {
              if (toastTimer.current) clearTimeout(toastTimer.current)
              setToast(null)
            }}
          />,
          document.body,
        )}
      {openInvoice && (
        <InvoiceDrawer
          invoice={openInvoice}
          onClose={() => setOpenInvoice(null)}
          onRequestDelete={setConfirmDelete}
          onShare={setShareTarget}
          onSplit={setSplitTarget}
          onLocationConfirmed={onLocationConfirmed}
        />
      )}
      {shareTarget && (
        <ShareDialog
          invoice={shareTarget}
          onClose={() => setShareTarget(null)}
          onCopy={copyLink}
        />
      )}
      {splitTarget && (
        <BillSplitDialog
          invoice={splitTarget}
          role={userRole}
          onClose={() => setSplitTarget(null)}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete this invoice?"
          message={`The receipt from ${confirmDelete.merchant} (€${confirmDelete.total.toFixed(2)}) will be permanently removed. This can't be undone.`}
          confirmLabel="Delete invoice"
          invoice={confirmDelete}
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </WorkspaceContext.Provider>
  )
}
