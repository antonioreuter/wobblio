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
import { INVOICE_DB, TODAY, type Invoice } from './invoice-data'
import { InvoiceDrawer } from './invoice-drawer'
import { ConfirmDialog } from './confirm-dialog'
import { ShareDialog } from './share-dialog'
import { WorkspaceToast, type ToastState, type ToastTone } from './workspace-toast'

interface WorkspaceContextValue {
  invoices: Invoice[]
  loading: boolean
  refreshing: boolean
  refresh: () => void
  removeInvoice: (id: number) => void
  openInvoice: Invoice | null
  setOpenInvoice: (inv: Invoice | null) => void
  setConfirmDelete: (inv: Invoice | null) => void
  setShareTarget: (inv: Invoice | null) => void
  showToast: (msg: string, tone?: ToastTone) => void
  scanReceipt: () => void
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used inside <WorkspaceProvider>')
  return ctx
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [invoices, setInvoices] = useState<Invoice[]>(INVOICE_DB)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [openInvoice, setOpenInvoice] = useState<Invoice | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Invoice | null>(null)
  const [shareTarget, setShareTarget] = useState<Invoice | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const id = setTimeout(() => { setInvoices(INVOICE_DB); setLoading(false) }, 1100)
    return () => clearTimeout(id)
  }, [])

  const showToast = useCallback((msg: string, tone: ToastTone = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, tone })
    const ms = tone === 'processing' ? 1600 : 6000
    toastTimer.current = setTimeout(() => setToast(null), ms)
  }, [])

  const refresh = useCallback(() => {
    if (refreshing) return
    setRefreshing(true)
    setTimeout(() => { setInvoices(INVOICE_DB); setRefreshing(false) }, 900)
  }, [refreshing])

  const removeInvoice = useCallback((id: number) => {
    setInvoices((list) => list.filter((x) => x.id !== id))
  }, [])

  const doDelete = useCallback(() => {
    if (!confirmDelete) return
    const inv = confirmDelete
    removeInvoice(inv.id)
    setOpenInvoice((curr) => (curr && curr.id === inv.id ? null : curr))
    setConfirmDelete(null)
    showToast(`${inv.merchant} invoice deleted.`, 'danger')
  }, [confirmDelete, removeInvoice, showToast])

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
    input.accept = 'image/png,image/jpeg,image/webp,application/pdf'
    input.onchange = () => {
      if (!input.files || !input.files.length) return
      showToast('Processing your receipt — this can take a few seconds…', 'processing')
      setTimeout(() => {
        const next: Invoice = {
          id: Date.now(),
          merchant: 'Albert Heijn',
          category: 'Groceries',
          dateISO: TODAY.toISOString().slice(0, 10),
          status: ['primary', 'Auto Parsed'],
          tags: ['weekly'],
          total: Math.round((10 + Math.random() * 40) * 100) / 100,
        }
        setInvoices((list) => [next, ...list])
        showToast('Receipt scanned — added to your invoices.', 'success')
      }, 1700)
    }
    input.click()
  }, [showToast])

  const value: WorkspaceContextValue = {
    invoices,
    loading,
    refreshing,
    refresh,
    removeInvoice,
    openInvoice,
    setOpenInvoice,
    setConfirmDelete,
    setShareTarget,
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
        />
      )}
      {shareTarget && (
        <ShareDialog
          invoice={shareTarget}
          onClose={() => setShareTarget(null)}
          onCopy={copyLink}
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
