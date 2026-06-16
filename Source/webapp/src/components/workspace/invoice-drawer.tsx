'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Box, Calendar, Share2, Shield, ShieldCheck, Tag as TagIcon, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react'
import { Badge, MerchantIcon, Tag } from '@/components/ds'
import { eur, fmtDate, type Invoice } from './invoice-data'

interface InvoiceDrawerProps {
  invoice: Invoice
  onClose: () => void
  onRequestDelete: (inv: Invoice) => void
  onShare: (inv: Invoice) => void
}

interface DetailLine {
  rawText: string
  quantity: number
  unitPrice: number | null
  lineTotal: number
}

interface InvoiceDetail {
  imageUrl?: string
  lines: DetailLine[]
}

export function InvoiceDrawer({ invoice, onClose, onRequestDelete, onShare }: InvoiceDrawerProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const [detail, setDetail] = useState<InvoiceDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(true)
  const [detailError, setDetailError] = useState(false)

  useEffect(() => {
    let active = true
    setLoadingDetail(true)
    setDetailError(false)
    fetch(`/api/invoices/${invoice.id}`, { cache: 'no-store' })
      .then((res) => { if (!res.ok) throw new Error(String(res.status)); return res.json() })
      .then((data: InvoiceDetail) => { if (active) setDetail(data) })
      .catch(() => { if (active) setDetailError(true) })
      .finally(() => { if (active) setLoadingDetail(false) })
    return () => { active = false }
  }, [invoice.id])

  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null)
  const [pop, setPop] = useState<'up' | 'down' | null>(null)
  const giveFeedback = (v: 'up' | 'down') => {
    setFeedback(v)
    setPop(v)
    setTimeout(() => setPop(null), 420)
  }

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
                {invoice.tags.length ? invoice.tags.map((t) => <Tag key={t}>{t}</Tag>) : <span className="dd-val">—</span>}
              </div>
            </div>
          </div>

          {detail?.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={detail.imageUrl}
              alt={`Receipt from ${invoice.merchant}`}
              style={{ width: '100%', borderRadius: 12, border: '1px solid var(--border)', objectFit: 'contain', maxHeight: 420 }}
            />
          )}

          <div className="drawer-receipt">
            <div className="receipt-head">
              <span>Item</span><span>Qty</span><span>Amount</span>
            </div>

            {loadingDetail && [0, 1, 2].map((i) => (
              <div className="receipt-row" key={`sk-${i}`}>
                <span className="ri-name"><span className="sk sk-line" style={{ width: 120 }} /></span>
                <span className="ri-qty"><span className="sk sk-line" style={{ width: 20 }} /></span>
                <span className="ri-amt"><span className="sk sk-line" style={{ width: 44, marginLeft: 'auto' }} /></span>
              </div>
            ))}

            {!loadingDetail && detail?.lines.map((it, i) => (
              <div className="receipt-row" key={i}>
                <span className="ri-name">{it.rawText}</span>
                <span className="ri-qty">×{it.quantity}</span>
                <span className="ri-amt">{eur(it.lineTotal)}</span>
              </div>
            ))}

            {!loadingDetail && !detailError && detail?.lines.length === 0 && (
              <div className="receipt-row"><span className="ri-name">No line items parsed yet.</span></div>
            )}

            {detailError && (
              <div className="receipt-row"><span className="ri-name">Couldn’t load line items.</span></div>
            )}

            <div className="receipt-totals">
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
