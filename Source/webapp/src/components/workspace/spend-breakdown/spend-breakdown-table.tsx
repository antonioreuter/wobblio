'use client'

import { formatViewMoney } from '@/lib/currency'
import type { SpendLevel, SpendNode } from './use-spend-breakdown'

interface SpendBreakdownTableProps {
  nodes: SpendNode[]
  level: SpendLevel
  currency: string | null
}

const HEADER: Record<SpendLevel, string> = {
  categories: 'Category',
  merchants: 'Merchant',
  'item-categories': 'Item category',
  items: 'Item',
}

// Chart/table parity (the accessible source of truth). Columns adapt to the level: merchants
// add an invoice count, items add a quantity.
export function SpendBreakdownTable({ nodes, level, currency }: SpendBreakdownTableProps) {
  return (
    <table className="spend-table" data-testid="spend-table">
      <thead>
        <tr>
          <th>{HEADER[level]}</th>
          {level === 'merchants' && <th className="num">Invoices</th>}
          {level === 'items' && <th className="num">Qty</th>}
          <th className="num">Amount</th>
          <th className="num">Share</th>
        </tr>
      </thead>
      <tbody>
        {nodes.map((node) => (
          <tr key={node.id} data-testid={`spend-row-${node.id}`}>
            <td>{node.name}</td>
            {level === 'merchants' && <td className="num">{node.invoiceCount ?? '—'}</td>}
            {level === 'items' && <td className="num">{node.quantity != null ? Number(node.quantity.toFixed(3)) : '—'}</td>}
            <td className="num">{formatViewMoney(node.amount, currency)}</td>
            <td className="num">{node.pct.toFixed(1)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
