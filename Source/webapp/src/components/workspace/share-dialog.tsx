'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Copy, MessageCircle, Share2 } from 'lucide-react'
import { eur, type Invoice } from './invoice-data'

interface ShareDialogProps {
  invoice: Invoice
  onClose: () => void
  onCopy: (link: string) => void
}

export function ShareDialog({ invoice, onClose, onCopy }: ShareDialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const link = `https://wobbl.io/r/${String(invoice.id).slice(-6)}`
  const waText = encodeURIComponent(
    `Here's our ${invoice.merchant} receipt (${eur(invoice.total)}) on Wobblio: ${link}`
  )

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="confirm-card share-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button type="button" className="dialog-close" aria-label="Close" onClick={onClose}>
          ✕
        </button>
        <div className="confirm-top">
          <div className="share-icon"><Share2 size={19} /></div>
          <div className="confirm-head">
            <h3 className="confirm-title">Share this receipt</h3>
            <p className="confirm-msg">
              Send the {invoice.merchant} receipt ({eur(invoice.total)}) to your household.
              Anyone with the link gets a read-only view — share it straight to WhatsApp or copy it below.
            </p>
          </div>
        </div>
        <div className="share-link">
          <input
            className="share-input"
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
          />
          <button
            type="button"
            className="btn btn--outline share-copy"
            onClick={() => onCopy(link)}
            data-testid="share-copy-link"
          >
            <Copy size={15} /> Copy
          </button>
        </div>
        <a
          className="btn whatsapp-btn"
          href={`https://wa.me/?text=${waText}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageCircle size={18} /> Share on WhatsApp
        </a>
      </div>
    </div>,
    document.body,
  )
}
