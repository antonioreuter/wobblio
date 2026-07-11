'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Box, Calendar, ImageIcon, MapPin, Share2, Shield, ShieldCheck, Tag as TagIcon, ThumbsDown, ThumbsUp, Trash2, Users } from 'lucide-react'
import { Badge, MerchantIcon, Tag } from '@/components/ds'
import { fmtMoney, fmtDate, type Invoice } from './invoice-data'
import { InvoiceLocationGate } from './invoice-location-gate'
import { ReceiptViewer } from './receipt-viewer'

interface InvoiceDrawerProps {
  invoice: Invoice
  onClose: () => void
  onRequestDelete: (inv: Invoice) => void
  onShare: (inv: Invoice) => void
  onSplit: (inv: Invoice) => void
  onLocationConfirmed: (status: 'RESOLVED' | 'HELD_UNMAPPED') => void
}

interface DetailLine {
  rawText: string
  quantity: number
  unitPrice: number | null
  lineTotal: number
  categoryName: string | null
}

interface InvoiceDetail {
  imageUrl?: string
  locationLabel?: string | null
  lines: DetailLine[]
  feedbackVerdict?: 'UP' | 'DOWN' | null
  total?: number | null
  currency?: string | null
  // §11 FX header: total converted into the viewer's home currency at the frozen
  // transaction-date rate, the effective from→home rate, and the home-currency code.
  // All null when the receipt is already in the home currency or no rate was available.
  totalHomeCurrency?: number | null
  fxRateUsed?: number | null
  homeCurrency?: string | null
}

export function InvoiceDrawer({ invoice, onClose, onRequestDelete, onShare, onSplit, onLocationConfirmed }: InvoiceDrawerProps) {
  const [viewerOpen, setViewerOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (viewerOpen) setViewerOpen(false)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, viewerOpen])

  const [detail, setDetail] = useState<InvoiceDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(true)
  const [detailError, setDetailError] = useState(false)
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null)
  const [pop, setPop] = useState<'up' | 'down' | null>(null)

  useEffect(() => {
    let active = true
    setLoadingDetail(true)
    setDetailError(false)
    fetch(`/api/invoices/${invoice.id}`, { cache: 'no-store' })
      .then((res) => { if (!res.ok) throw new Error(String(res.status)); return res.json() })
      .then((data: InvoiceDetail) => {
        if (!active) return
        setDetail(data)
        setFeedback(data.feedbackVerdict ? (data.feedbackVerdict === 'UP' ? 'up' : 'down') : null)
      })
      .catch(() => { if (active) setDetailError(true) })
      .finally(() => { if (active) setLoadingDetail(false) })
    return () => { active = false }
  }, [invoice.id])

  // Optimistic: light the thumb immediately, persist, revert on failure.
  const giveFeedback = (v: 'up' | 'down') => {
    const prev = feedback
    setFeedback(v)
    setPop(v)
    setTimeout(() => setPop(null), 420)
    fetch(`/api/invoices/${invoice.id}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verdict: v === 'up' ? 'UP' : 'DOWN' }),
    })
      .then((res) => { if (!res.ok) throw new Error(String(res.status)) })
      .catch(() => setFeedback(prev))
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="drawer-overlay" onClick={onClose} data-testid="invoice-drawer">
      {viewerOpen && detail?.imageUrl && (
        <aside className="invoice-image-panel" onClick={(e) => e.stopPropagation()} data-testid="receipt-panel">
          <div className="image-panel-head">
            <span className="image-panel-title"><ImageIcon size={15} /> Receipt · {invoice.merchant}</span>
            <button
              type="button"
              className="drawer-close"
              aria-label="Close receipt"
              onClick={() => setViewerOpen(false)}
              data-testid="receipt-panel-close"
            >
              ✕
            </button>
          </div>
          <ReceiptViewer imageUrl={detail.imageUrl} />
        </aside>
      )}

      <aside className="invoice-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div className="drawer-merchant">
            <MerchantIcon merchant={invoice.merchant} size={40} />
            <div>
              <div className="drawer-title">{invoice.merchant}</div>
              {detail?.locationLabel && (
                <div className="drawer-location"><MapPin size={13} /> {detail.locationLabel}</div>
              )}
            </div>
          </div>
          <div className="drawer-head-right">
            <div className="drawer-amounts">
              <span className="drawer-total">{fmtMoney(detail?.total ?? invoice.total, detail?.currency ?? invoice.currency)}</span>
              {detail?.fxRateUsed != null && detail.totalHomeCurrency != null && detail.homeCurrency && detail.homeCurrency !== detail.currency && (
                <>
                  <span className="drawer-sub">≈ {fmtMoney(detail.totalHomeCurrency, detail.homeCurrency)}</span>
                  <span className="drawer-sub">{`1 ${detail.homeCurrency} = ${(1 / detail.fxRateUsed).toFixed(4)} ${detail.currency}`}</span>
                </>
              )}
            </div>
            <button type="button" className="drawer-close" aria-label="Close" onClick={onClose}>
              ✕
            </button>
          </div>
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

          <InvoiceLocationGate invoice={invoice} onConfirmed={onLocationConfirmed} />

          {detail?.imageUrl && (
            <div className="receipt-view-wrapper">
              <button
                type="button"
                className="btn btn--outline receipt-view-btn"
                onClick={() => setViewerOpen((v) => !v)}
                aria-pressed={viewerOpen}
                data-testid="view-receipt"
              >
                <ImageIcon size={15} /> {viewerOpen ? 'Hide receipt' : 'View receipt'}
              </button>
            </div>
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
                <span className="ri-name">
                  {it.rawText}
                  {it.categoryName && <span className="ri-cat">{it.categoryName}</span>}
                </span>
                <span className="ri-qty">×{it.quantity}</span>
                <span className="ri-amt">{fmtMoney(it.lineTotal, detail?.currency ?? invoice.currency)}</span>
              </div>
            ))}

            {!loadingDetail && !detailError && detail?.lines.length === 0 && (
              <div className="receipt-row"><span className="ri-name">No line items parsed yet.</span></div>
            )}

            {detailError && (
              <div className="receipt-row"><span className="ri-name">Couldn’t load line items.</span></div>
            )}

            <div className="receipt-totals">
              <div className="receipt-grand"><span>Total</span><span>{fmtMoney(detail?.total ?? invoice.total, detail?.currency ?? invoice.currency)}</span></div>
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
            className="btn btn--success"
            style={{ flex: 1 }}
            onClick={() => onShare(invoice)}
          >
            <Share2 size={15} /> Share
          </button>
          {invoice.status[1] === 'Ready' && (
            <button
              type="button"
              className="btn btn--brand"
              style={{ flex: 1 }}
              onClick={() => onSplit(invoice)}
              data-testid="split-open"
            >
              <Users size={15} /> Split bill
            </button>
          )}
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
