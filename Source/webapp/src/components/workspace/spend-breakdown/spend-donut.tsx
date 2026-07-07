'use client'

import { formatViewMoney } from '@/lib/currency'
import { spendColor } from './palette'
import type { SpendNode } from './use-spend-breakdown'

interface SpendDonutProps {
  nodes: SpendNode[]
  total: number
  currency: string | null
}

const RADIUS = 70
const STROKE = 26
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

// Share-of-wallet donut for the top (category) level. Only positive amounts form slices —
// discounts net negative and would distort a share ring, so they're shown in the ranked
// list/table instead. Center prints the window total. Sized off the node order so slice
// colours match the bar list.
export function SpendDonut({ nodes, total, currency }: SpendDonutProps) {
  const positives = nodes
    .map((n, i) => ({ node: n, color: spendColor(i) }))
    .filter((s) => s.node.amount > 0)
  const positiveTotal = positives.reduce((acc, s) => acc + s.node.amount, 0)

  if (positiveTotal <= 0) return null

  let offset = 0
  const arcs = positives.map((s) => {
    const fraction = s.node.amount / positiveTotal
    const length = fraction * CIRCUMFERENCE
    const arc = (
      <circle
        key={s.node.id}
        cx="90"
        cy="90"
        r={RADIUS}
        fill="none"
        stroke={s.color}
        strokeWidth={STROKE}
        strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
        strokeDashoffset={-offset}
        data-testid={`spend-donut-slice-${s.node.id}`}
      />
    )
    offset += length
    return arc
  })

  return (
    <div className="spend-donut" data-testid="spend-donut">
      <svg viewBox="0 0 180 180" width="180" height="180" role="img" aria-label="Spend by category share">
        <g transform="rotate(-90 90 90)">{arcs}</g>
        <text x="90" y="84" textAnchor="middle" className="spend-donut-total-label">
          Total
        </text>
        <text x="90" y="104" textAnchor="middle" className="spend-donut-total">
          {formatViewMoney(total, currency)}
        </text>
      </svg>
    </div>
  )
}
