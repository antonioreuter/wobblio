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

/** Weekly scan quota for the current tenant (§2.4). */
export interface Usage {
  used: number
  cap: number
  remaining: number
}

async function fetchUsage(): Promise<Usage | null> {
  const res = await fetch('/api/me/usage', { cache: 'no-store' })
  if (!res.ok) return null
  return (await res.json()) as Usage
}

interface WorkspaceContextValue {
  invoices: Invoice[]
  usage: Usage | null
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
  const [usage, setUsage] = useState<Usage | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [openInvoice, setOpenInvoice] = useState<Invoice | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Invoice | null>(null)
  const [shareTarget, setShareTarget] = useState<Invoice | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadInvoices = useCallback(() => fetchInvoices().then(setInvoices), [])
  const loadUsage = useCallback(() => fetchUsage().then(setUsage), [])

  useEffect(() => {
    loadInvoices().catch(() => undefined).finally(() => setLoading(false))
    loadUsage().catch(() => undefined)
  }, [loadInvoices, loadUsage])

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
    loadInvoices().catch(() => undefined).finally(() => setRefreshing(false))
  }, [refreshing, loadInvoices, loadUsage])

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
      showToast(`${inv.merchant} invoice deleted.`, 'danger')
    } catch {
      void loadInvoices().catch(() => undefined)
      showToast(`Couldn’t delete the ${inv.merchant} invoice — please try again.`, 'danger')
    }
  }, [confirmDelete, removeInvoice, showToast, loadInvoices])

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
  }, [showToast, loadInvoices])

  const value: WorkspaceContextValue = {
    invoices,
    usage,
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
