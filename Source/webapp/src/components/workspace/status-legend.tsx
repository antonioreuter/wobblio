'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'
import { Badge } from '@/components/ds'
import { STATUS_LEGEND } from '@/lib/invoice-map'

/**
 * Global, click-to-open explainer for the invoice status badges. Self-contained:
 * owns its own open state so it can be dropped into the table header or the
 * panel header without lifting state. Mirrors the confirm-dialog modal pattern.
 */
export function StatusHelpButton({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className={`status-help-btn ${className}`.trim()}
        aria-label="What do these statuses mean?"
        title="What do these statuses mean?"
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        data-testid="status-help-trigger"
      >
        <Info size={14} />
      </button>
      {open && <StatusLegendModal onClose={() => setOpen(false)} />}
    </>
  )
}

function StatusLegendModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="modal-overlay" onClick={onClose} data-testid="status-legend-overlay">
      <div
        className="confirm-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Invoice status guide"
      >
        <button
          type="button"
          className="dialog-close"
          aria-label="Close"
          onClick={onClose}
          data-testid="status-legend-close"
        >
          ✕
        </button>
        <div className="confirm-head">
          <h3 className="confirm-title">What each status means</h3>
          <p className="confirm-msg">
            Every receipt you upload moves through these states. Here&apos;s what to expect.
          </p>
        </div>
        <dl className="status-legend" data-testid="status-legend">
          {STATUS_LEGEND.map((s) => (
            <div className="status-legend-row" key={s.label}>
              <dt><Badge tone={s.tone}>{s.label}</Badge></dt>
              <dd>{s.description}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>,
    document.body,
  )
}
