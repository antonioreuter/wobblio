'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { formatViewMoney } from '@/lib/currency'
import type { SpendNode } from './use-spend-breakdown'

interface SpendItemsProps {
  nodes: SpendNode[]
  currency: string | null
  // Product view aggregates across stores, so each occurrence names its merchant. Store view
  // already fixed the merchant one level up, so it stays hidden there.
  showMerchant: boolean
}

// Leaf level: one row per product (grouped across trips), expandable to the individual
// occurrences with a link back to each source invoice. No further drill.
export function SpendItems({ nodes, currency, showMerchant }: SpendItemsProps) {
  if (nodes.length === 0) {
    return (
      <div className="table-empty" data-testid="spend-empty">
        <span>No items in this period here — try a wider range or “All regions”.</span>
      </div>
    )
  }
  return (
    <ul className="spend-items" data-testid="spend-items">
      {nodes.map((node) => (
        <SpendItemRow key={node.id} node={node} currency={currency} showMerchant={showMerchant} />
      ))}
    </ul>
  )
}

function SpendItemRow({ node, currency, showMerchant }: { node: SpendNode; currency: string | null; showMerchant: boolean }) {
  const [open, setOpen] = useState(false)
  const occurrences = node.occurrences ?? []
  // Expandable at >=1 so even a one-off purchase can be traced to its source invoice.
  const expandable = occurrences.length >= 1

  return (
    <li className="spend-item">
      <button
        type="button"
        className={`spend-item-head ${expandable ? 'is-interactive' : ''}`}
        onClick={expandable ? () => setOpen((o) => !o) : undefined}
        disabled={!expandable}
        data-testid={`spend-item-${node.id}`}
      >
        <span className="spend-item-caret">
          {expandable ? (open ? <ChevronDown size={15} /> : <ChevronRight size={15} />) : null}
        </span>
        <span className="spend-item-name">{node.name}</span>
        <span className="spend-item-qty">×{trimQty(node.quantity ?? 0)}</span>
        <span className="spend-item-amount">{formatViewMoney(node.amount, currency)}</span>
      </button>
      {open && (
        <ul className="spend-item-occurrences">
          {occurrences.map((occ, i) => (
            <li key={`${occ.invoiceId}-${i}`} className="spend-occurrence">
              <span className="spend-occurrence-date">{occ.date}</span>
              {showMerchant && (
                <span className="spend-occurrence-merchant">{occ.merchantName ?? 'Unknown merchant'}</span>
              )}
              <span className="spend-occurrence-qty">×{trimQty(occ.quantity)}</span>
              <span className="spend-occurrence-amount">{formatViewMoney(occ.amount, currency)}</span>
              <Link href={`/invoices/${occ.invoiceId}`} className="spend-occurrence-link">
                View
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

// Quantities are stored to 3 dp; drop trailing zeros so "2.000" reads "2" but "1.5" survives.
function trimQty(qty: number): string {
  return Number(qty.toFixed(3)).toString()
}
