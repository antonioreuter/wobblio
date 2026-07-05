'use client'

import { Copy, MessageCircle } from 'lucide-react'

interface ShareLinkProps {
  // The minted share URL, or null while it is still being created.
  link: string | null
  // Plain (un-encoded) message body for the WhatsApp deep-link.
  waText: string
  onCopy: (link: string) => void
  copyTestId?: string
  containerTestId?: string
}

// The standard "read-only link + Copy + Share on WhatsApp" panel used wherever the app
// hands out a public share URL (invoices, bill splits). One visual identity, one component.
export function ShareLink({ link, waText, onCopy, copyTestId, containerTestId }: ShareLinkProps) {
  const ready = link !== null

  return (
    <>
      <div className="share-link" data-testid={containerTestId}>
        <input
          className="share-input"
          readOnly
          value={ready ? link : 'Creating link…'}
          onFocus={(e) => e.currentTarget.select()}
        />
        <button
          type="button"
          className="btn btn--outline share-copy"
          onClick={() => ready && onCopy(link)}
          disabled={!ready}
          data-testid={copyTestId}
        >
          <Copy size={15} /> Copy
        </button>
      </div>
      <a
        className="btn whatsapp-btn"
        href={`https://wa.me/?text=${encodeURIComponent(waText)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={!ready}
        onClick={(e) => { if (!ready) e.preventDefault() }}
      >
        <MessageCircle size={18} /> Share on WhatsApp
      </a>
    </>
  )
}
