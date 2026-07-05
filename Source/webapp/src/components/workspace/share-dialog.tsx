'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Share2 } from 'lucide-react'
import { eur, type Invoice } from './invoice-data'
import { ShareLink } from './share-link'

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

  const link = linkState.status === 'ready' ? linkState.link : null
  const waText = `Here's our ${invoice.merchant} receipt (${eur(invoice.total)}) on Wobblio: ${link ?? ''}`

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
          <ShareLink link={link} waText={waText} onCopy={onCopy} copyTestId="share-copy-link" />
        )}
      </div>
    </div>,
    document.body,
  )
}
