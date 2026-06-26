'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'

/**
 * Click-to-open explainer for how Price Trends are built. Self-contained (owns its open
 * state) so it can sit in the page header without lifting state. Mirrors the
 * StatusHelpButton / confirm-dialog modal pattern.
 */
export function PriceTrendsHelpButton({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className={`status-help-btn ${className}`.trim()}
        aria-label="How do Price Trends work?"
        title="How do Price Trends work?"
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        data-testid="trends-help-trigger"
      >
        <Info size={14} />
      </button>
      {open && <PriceTrendsHelpModal onClose={() => setOpen(false)} />}
    </>
  )
}

const TREND_HELP_POINTS: { title: string; body: string }[] = [
  {
    title: 'Your purchases',
    body: 'The dashed line is the price you paid, charted from your own receipts. It shows even for items only you have bought.',
  },
  {
    title: 'Local-store comparison',
    body: 'Solid lines compare local stores. A store appears only once at least 3 confirmed scans of the item exist nearby, so prices stay reliable and anonymous.',
  },
  {
    title: 'Filtered by region',
    body: 'The local-store comparison is limited to the region in the picker. Switch regions to see prices somewhere else.',
  },
  {
    title: 'Region must be confirmed',
    body: 'The local-store comparison counts a receipt only once its region is confirmed. Your own purchases chart right away — including receipts still awaiting location confirmation.',
  },
]

function PriceTrendsHelpModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="modal-overlay" onClick={onClose} data-testid="trends-help-overlay">
      <div
        className="confirm-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="How Price Trends work"
      >
        <button
          type="button"
          className="dialog-close"
          aria-label="Close"
          onClick={onClose}
          data-testid="trends-help-close"
        >
          ✕
        </button>
        <div className="confirm-head">
          <h3 className="confirm-title">How Price Trends work</h3>
          <p className="confirm-msg">Every scan makes the comparison smarter.</p>
        </div>
        <dl className="status-legend" data-testid="trends-help">
          {TREND_HELP_POINTS.map((p) => (
            <div className="status-legend-row" key={p.title}>
              <dt><strong>{p.title}</strong></dt>
              <dd>{p.body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>,
    document.body,
  )
}
