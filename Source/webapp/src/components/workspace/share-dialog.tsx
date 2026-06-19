'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Copy, MessageCircle, Share2 } from 'lucide-react'
import { eur, type Invoice } from './invoice-data'

interface ShareDialogProps {
  invoice: Invoice
  onClose: () => void
  onCopy: (link: string) => void
}

type LinkState =
  | { status: 'loading' }
  | { status: 'ready'; link: string }
  | { status: 'error' }

export function ShareDialog({ invoice, onClose, onCopy }: ShareDialogProps) {
  const [linkState, setLinkState] = useState<LinkState>({ status: 'loading' })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Mint a real public share link on open. The backend returns an unguessable
  // /r/<token> URL (7-day expiry); the invoice id is never exposed.
  useEffect(() => {
    let active = true
    fetch(`/api/invoices/${invoice.id}/share`, { method: 'POST' })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status))
        const data = (await res.json()) as { shareUrl: string }
        if (active) setLinkState({ status: 'ready', link: data.shareUrl })
      })
      .catch(() => { if (active) setLinkState({ status: 'error' }) })
    return () => { active = false }
  }, [invoice.id])

  const link = linkState.status === 'ready' ? linkState.link : ''
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
        {linkState.status === 'error' ? (
          <p className="confirm-msg" data-testid="share-error">
            Couldn’t create a share link — please close this and try again.
          </p>
        ) : (
          <>
            <div className="share-link">
              <input
                className="share-input"
                readOnly
                value={linkState.status === 'ready' ? link : 'Creating link…'}
                onFocus={(e) => e.currentTarget.select()}
              />
              <button
                type="button"
                className="btn btn--outline share-copy"
                onClick={() => onCopy(link)}
                disabled={linkState.status !== 'ready'}
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
              aria-disabled={linkState.status !== 'ready'}
              onClick={(e) => { if (linkState.status !== 'ready') e.preventDefault() }}
            >
              <MessageCircle size={18} /> Share on WhatsApp
            </a>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
