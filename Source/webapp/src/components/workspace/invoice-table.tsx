'use client'

import type { CSSProperties } from 'react'
import { MapPin, ReceiptText, Share2, Trash2 } from 'lucide-react'
import { Badge, Tag, CategoryIcon } from '@/components/ds'
import { fmtMoney, fmtDate, needsLocationConfirmation, type Invoice } from './invoice-data'
import { StatusHelpButton } from './status-legend'

interface InvoiceTableProps {
  invoices: Invoice[]
  loading?: boolean
  skeletonRows?: number
  /** Cascade rows in on mount; only newly-rendered rows animate. */
  animateRows?: boolean
  /** Index where the latest batch begins, so each page cascades from 0 with no leading pause. */
  staggerStart?: number
  onOpen?: (inv: Invoice) => void
  onRequestDelete?: (inv: Invoice) => void
  onShare?: (inv: Invoice) => void
}

export function InvoiceTable({
  invoices,
  loading = false,
  skeletonRows = 5,
  animateRows = false,
  staggerStart = 0,
  onOpen,
  onRequestDelete,
  onShare,
}: InvoiceTableProps) {
  return (
    <div className="table-scroll">
      <table className="app-table">
        <thead>
          <tr>
            <th>Merchant</th>
            <th className="col-cat">Category</th>
            <th>Date</th>
            <th><span className="th-help">Status <StatusHelpButton className="status-help--inline" /></span></th>
            <th className="col-tags">Tags</th>
            <th className="num">Total</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading &&
            Array.from({ length: skeletonRows }).map((_, i) => (
              <tr key={`sk-${i}`}>
                <td>
                  <div className="merchant-cell">
                    <span className="sk sk-avatar" />
                    <span className="sk sk-line" style={{ width: 120 }} />
                  </div>
                </td>
                <td className="col-cat"><span className="sk sk-line" style={{ width: 80 }} /></td>
                <td><span className="sk sk-line" style={{ width: 78 }} /></td>
                <td><span className="sk sk-pill" /></td>
                <td className="col-tags"><span className="sk sk-line" style={{ width: 60 }} /></td>
                <td className="num"><span className="sk sk-line" style={{ width: 52, marginLeft: 'auto' }} /></td>
                <td><span className="sk sk-line" style={{ width: 48, marginLeft: 'auto' }} /></td>
              </tr>
            ))}
          {!loading &&
            invoices.map((inv, i) => (
              <tr
                key={inv.id}
                className={animateRows ? 'inv-row-in' : undefined}
                style={animateRows ? ({ ['--row-i']: Math.max(0, i - staggerStart) } as CSSProperties) : undefined}
                onClick={() => onOpen?.(inv)}
                data-testid={`invoice-row-${inv.id}`}
              >
                <td className="cell-merchant">
                  <div className="merchant-cell">
                    <span className="m-icon">
                      <span style={{ width: 28, height: 28, borderRadius: 'var(--radius-md)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <CategoryIcon categoryId={inv.categoryId} size={16} />
                      </span>
                    </span>{' '}
                    <span className="m-name">{inv.merchant}</span>
                  </div>
                </td>
                <td className="col-cat cell-cat">{inv.category}</td>
                <td className="cell-date">{fmtDate(inv.dateISO)}</td>
                <td className="cell-status">
                  <Badge
                    tone={inv.status[0]}
                    className={inv.isProcessing ? 'badge--working' : undefined}
                    data-testid={`invoice-status-${inv.id}`}
                  >
                    {inv.status[1]}
                  </Badge>
                  {needsLocationConfirmation(inv) && (
                    <button
                      type="button"
                      className="loc-chip"
                      title="Confirm where you shopped to share prices"
                      onClick={(e) => { e.stopPropagation(); onOpen?.(inv) }}
                      data-testid={`invoice-location-chip-${inv.id}`}
                    >
                      <MapPin size={12} /> Add location
                    </button>
                  )}
                </td>
                <td className="col-tags cell-tags">
                  <div className="tag-row">
                    {inv.tags.map((t) => <Tag key={t}>{t}</Tag>)}
                  </div>
                </td>
                <td className="num cell-total">{fmtMoney(inv.total, inv.currency)}</td>
                <td className="cell-actions">
                  <div className="row-actions">
                    <button
                      type="button"
                      className="row-action"
                      title="Share invoice"
                      onClick={(e) => { e.stopPropagation(); onShare?.(inv) }}
                      aria-label="Share invoice"
                    >
                      <Share2 size={14} />
                    </button>
                    <button
                      type="button"
                      className="row-action danger"
                      title="Delete invoice"
                      onClick={(e) => { e.stopPropagation(); onRequestDelete?.(inv) }}
                      aria-label="Delete invoice"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          {!loading && invoices.length === 0 && (
            <tr>
              <td colSpan={7}>
                <div className="table-empty">
                  <ReceiptText size={26} />
                  <span>No invoices match your selected filters.</span>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
