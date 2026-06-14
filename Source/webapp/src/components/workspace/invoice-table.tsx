'use client'

import { ReceiptText, Share2, Trash2 } from 'lucide-react'
import { Badge, MerchantIcon, Tag } from '@/components/ds'
import { eur, fmtDate, type Invoice } from './invoice-data'

interface InvoiceTableProps {
  invoices: Invoice[]
  loading?: boolean
  skeletonRows?: number
  onOpen?: (inv: Invoice) => void
  onRequestDelete?: (inv: Invoice) => void
  onShare?: (inv: Invoice) => void
}

export function InvoiceTable({
  invoices,
  loading = false,
  skeletonRows = 5,
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
            <th>Status</th>
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
            invoices.map((inv) => (
              <tr
                key={inv.id}
                onClick={() => onOpen?.(inv)}
                data-testid={`invoice-row-${inv.id}`}
              >
                <td className="cell-merchant">
                  <div className="merchant-cell">
                    <span className="m-icon"><MerchantIcon merchant={inv.merchant} /></span>{' '}
                    <span className="m-name">{inv.merchant}</span>
                  </div>
                </td>
                <td className="col-cat cell-cat">{inv.category}</td>
                <td className="cell-date">{fmtDate(inv.dateISO)}</td>
                <td className="cell-status"><Badge tone={inv.status[0]}>{inv.status[1]}</Badge></td>
                <td className="col-tags cell-tags">
                  <div className="tag-row">
                    {inv.tags.map((t) => <Tag key={t}>{t}</Tag>)}
                  </div>
                </td>
                <td className="num cell-total">{eur(inv.total)}</td>
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
