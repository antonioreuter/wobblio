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
import { type Invoice } from './invoice-data'
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
        showToast('Receipt uploaded — processing in the background…', 'processing')
        // Show the PROCESSING row immediately, then poll as the worker parses it.
        // The weekly counter increments once the upload is accepted, so refresh
        // usage alongside each invoice poll.
        void loadInvoices().catch(() => undefined)
        void loadUsage().catch(() => undefined)
        ;[2500, 5000, 9000].forEach((ms) =>
          setTimeout(() => {
            void loadInvoices().catch(() => undefined)
            void loadUsage().catch(() => undefined)
          }, ms),
        )
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
