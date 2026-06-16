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
import { InvoiceDrawer } from './invoice-drawer'
import { ConfirmDialog } from './confirm-dialog'
import { ShareDialog } from './share-dialog'
import { WorkspaceToast, type ToastState, type ToastTone } from './workspace-toast'
import { mapInvoice, type BackendInvoice } from '@/lib/invoice-map'
import { uploadReceipt, UploadError } from '@/lib/upload-receipt'

async function fetchInvoices(): Promise<Invoice[]> {
  const res = await fetch('/api/invoices', { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to load invoices (${res.status})`)
  const data = (await res.json()) as { invoices: BackendInvoice[] }
  return data.invoices.map(mapInvoice)
}

interface WorkspaceContextValue {
  invoices: Invoice[]
  loading: boolean
  refreshing: boolean
  refresh: () => void
  removeInvoice: (id: string) => void
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
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [openInvoice, setOpenInvoice] = useState<Invoice | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Invoice | null>(null)
  const [shareTarget, setShareTarget] = useState<Invoice | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadInvoices = useCallback(() => fetchInvoices().then(setInvoices), [])

  useEffect(() => {
    loadInvoices().catch(() => undefined).finally(() => setLoading(false))
  }, [loadInvoices])

  const showToast = useCallback((msg: string, tone: ToastTone = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, tone })
    const ms = tone === 'processing' ? 1600 : 6000
    toastTimer.current = setTimeout(() => setToast(null), ms)
  }, [])

  const refresh = useCallback(() => {
    if (refreshing) return
    setRefreshing(true)
    loadInvoices().catch(() => undefined).finally(() => setRefreshing(false))
  }, [refreshing, loadInvoices])

  const removeInvoice = useCallback((id: string) => {
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
    input.accept = 'image/png,image/jpeg,image/webp'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      showToast('Uploading your receipt…', 'processing')
      try {
        await uploadReceipt(file)
        showToast('Receipt uploaded — processing in the background…', 'processing')
        // Show the PROCESSING row immediately, then poll as the worker parses it.
        void loadInvoices().catch(() => undefined)
        ;[2500, 5000, 9000].forEach((ms) =>
          setTimeout(() => void loadInvoices().catch(() => undefined), ms),
        )
      } catch (err) {
        const msg = err instanceof UploadError ? err.message : 'Upload failed — please try again.'
        showToast(msg, 'danger')
      }
    }
    input.click()
  }, [showToast, loadInvoices])

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
