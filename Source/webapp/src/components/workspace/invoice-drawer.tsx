'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Box, Calendar, Share2, Shield, ShieldCheck, Tag as TagIcon, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react'
import { Badge, MerchantIcon, Tag } from '@/components/ds'
import { eur, fmtDate, type Invoice } from './invoice-data'
import { buildLineItems } from './item-catalog'

interface InvoiceDrawerProps {
  invoice: Invoice
  onClose: () => void
  onRequestDelete: (inv: Invoice) => void
  onShare: (inv: Invoice) => void
}

export function InvoiceDrawer({ invoice, onClose, onRequestDelete, onShare }: InvoiceDrawerProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null)
  const [pop, setPop] = useState<'up' | 'down' | null>(null)
  const giveFeedback = (v: 'up' | 'down') => {
    setFeedback(v)
    setPop(v)
    setTimeout(() => setPop(null), 420)
  }

  const items = buildLineItems(invoice)
  const subtotal = items.reduce((s, it) => s + it.lineTotal, 0)
  const vat = Math.round(subtotal * 0.09 * 100) / 100

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="drawer-overlay" onClick={onClose} data-testid="invoice-drawer">
      <aside className="invoice-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div className="drawer-merchant">
            <MerchantIcon merchant={invoice.merchant} size={40} />
            <div>
              <div className="drawer-title">{invoice.merchant}</div>
            </div>
          </div>
          <button type="button" className="drawer-close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="drawer-body">
          <div className="drawer-details">
            <div className="dd-row">
              <span className="dd-label"><Box size={14} /> Category</span>
              <span className="dd-val">{invoice.category}</span>
            </div>
            <div className="dd-row">
              <span className="dd-label"><Calendar size={14} /> Date</span>
              <span className="dd-val">{fmtDate(invoice.dateISO)}</span>
            </div>
            <div className="dd-row">
              <span className="dd-label"><Shield size={14} /> Status</span>
              <Badge tone={invoice.status[0]}>{invoice.status[1]}</Badge>
            </div>
            <div className="dd-row">
              <span className="dd-label"><TagIcon size={14} /> Tags</span>
              <div className="tag-row">
                {invoice.tags.map((t) => <Tag key={t}>{t}</Tag>)}
              </div>
            </div>
          </div>

          <div className="drawer-receipt">
            <div className="receipt-head">
              <span>Item</span><span>Qty</span><span>Amount</span>
            </div>
            {items.map((it, i) => (
              <div className="receipt-row" key={i}>
                <span className="ri-name">{it.name}</span>
                <span className="ri-qty">×{it.qty}</span>
                <span className="ri-amt">{eur(it.lineTotal)}</span>
              </div>
            ))}
            <div className="receipt-totals">
              <div><span>Subtotal</span><span>{eur(subtotal - vat)}</span></div>
              <div><span>VAT (9%)</span><span>{eur(vat)}</span></div>
              <div className="receipt-grand"><span>Total</span><span>{eur(invoice.total)}</span></div>
            </div>
          </div>

          <div className="drawer-note">
            <ShieldCheck size={14} /> Parsed automatically · location metadata removed.
          </div>

          <div className="drawer-feedback">
            <div className="fb-copy">
              <span className="fb-q">
                {feedback ? 'Thanks — your feedback trains the scanner.' : 'Did we capture this receipt correctly?'}
              </span>
              {!feedback && (
                <span className="fb-hint">A quick rating helps us improve AI accuracy for everyone.</span>
              )}
            </div>
            <div className="fb-btns">
              <button
                type="button"
                className={`fb-btn up ${feedback === 'up' ? 'on' : ''} ${pop === 'up' ? 'pop' : ''}`}
                aria-label="Accurate"
                onClick={() => giveFeedback('up')}
              >
                <ThumbsUp size={17} />
              </button>
              <button
                type="button"
                className={`fb-btn down ${feedback === 'down' ? 'on' : ''} ${pop === 'down' ? 'pop' : ''}`}
                aria-label="Inaccurate"
                onClick={() => giveFeedback('down')}
              >
                <ThumbsDown size={17} />
              </button>
            </div>
          </div>
        </div>

        <div className="drawer-foot">
          <button
            type="button"
            className="btn btn--outline"
            style={{ flex: 1 }}
            onClick={() => onShare(invoice)}
          >
            <Share2 size={15} /> Share
          </button>
          <button
            type="button"
            className="btn btn--outline drawer-del"
            onClick={() => onRequestDelete(invoice)}
          >
            <Trash2 size={15} /> Delete
          </button>
        </div>
      </aside>
    </div>,
    document.body,
  )
}
