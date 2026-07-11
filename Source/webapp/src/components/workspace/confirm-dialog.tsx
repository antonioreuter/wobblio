'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { MerchantIcon } from '@/components/ds'
import { fmtMoney, fmtDate, type Invoice } from './invoice-data'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel: string
  invoice?: Invoice
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  invoice,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="modal-overlay" onClick={onCancel} data-testid="confirm-dialog">
      <div
        className="confirm-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          className="dialog-close"
          aria-label="Close"
          onClick={onCancel}
          data-testid="confirm-cancel"
        >
          ✕
        </button>
        <div className="confirm-top">
          <div className="confirm-icon"><AlertTriangle size={20} /></div>
          <div className="confirm-head">
            <h3 className="confirm-title">{title}</h3>
            <p className="confirm-msg">{message}</p>
          </div>
        </div>
        {invoice && (
          <div className="confirm-preview">
            <MerchantIcon merchant={invoice.merchant} size={36} />
            <div className="cp-meta">
              <span className="cp-name">{invoice.merchant}</span>
              <span className="cp-sub">{fmtDate(invoice.dateISO)} · {invoice.category}</span>
            </div>
            <span className="cp-amt">{fmtMoney(invoice.total, invoice.currency)}</span>
          </div>
        )}
        <div className="confirm-actions">
          <button type="button" className="btn btn--outline" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn confirm-danger"
            onClick={onConfirm}
            data-testid="confirm-delete"
          >
            <Trash2 size={15} /> {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
