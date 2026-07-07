'use client'

import { ChevronRight, Lock, Store } from 'lucide-react'
import { CategoryIcon } from '@/components/ds'
import { formatViewMoney } from '@/lib/currency'
import { spendColor } from './palette'
import type { SpendLevel, SpendNode } from './use-spend-breakdown'

interface SpendBarsProps {
  nodes: SpendNode[]
  level: SpendLevel
  currency: string | null
  drillable: boolean // rows descend a level when clicked
  locked: boolean // rows show a lock and open the upsell instead of drilling (STANDARD → item level)
  onDrill: (node: SpendNode) => void
  onLocked: () => void
}

// Ranked horizontal bars — the drill primitive at category / merchant / item-category levels.
// Sorted biggest-first by the backend; bar width is share of the largest absolute amount so a
// net-negative discount bucket still reads. Colour matches the donot slice by index.
export function SpendBars({ nodes, level, currency, drillable, locked, onDrill, onLocked }: SpendBarsProps) {
  if (nodes.length === 0) {
    return (
      <div className="table-empty" data-testid="spend-empty">
        <span>No spend in this period{level === 'categories' ? '' : ' here'} — try a wider range or “All regions”.</span>
      </div>
    )
  }

  const maxAbs = Math.max(...nodes.map((n) => Math.abs(n.amount)), 0)
  const interactive = drillable || locked

  return (
    <ul className="spend-bars" data-testid="spend-bars">
      {nodes.map((node, i) => {
        const width = maxAbs > 0 ? `${(Math.abs(node.amount) / maxAbs) * 100}%` : '0%'
        const negative = node.amount < 0
        const handleClick = () => {
          if (locked) return onLocked()
          if (drillable) return onDrill(node)
        }
        return (
          <li key={node.id}>
            <button
              type="button"
              className={`spend-bar-row ${interactive ? 'is-interactive' : ''}`}
              onClick={interactive ? handleClick : undefined}
              disabled={!interactive}
              data-testid={`spend-node-${node.id}`}
              aria-label={`${node.name}: ${formatViewMoney(node.amount, currency)}`}
            >
              <span className="spend-bar-icon">
                {level === 'merchants' ? <Store size={16} /> : <CategoryIcon categoryId={node.id} size={16} />}
              </span>
              <span className="spend-bar-main">
                <span className="spend-bar-head">
                  <span className="spend-bar-name">{node.name}</span>
                  <span className={`spend-bar-amount ${negative ? 'is-negative' : ''}`}>
                    {formatViewMoney(node.amount, currency)}
                  </span>
                </span>
                <span className="spend-bar-track">
                  <span
                    className={`spend-bar-fill ${negative ? 'is-negative' : ''}`}
                    style={{ width, background: negative ? undefined : spendColor(i) }}
                  />
                </span>
                <span className="spend-bar-meta">
                  <span>{node.pct.toFixed(1)}%</span>
                  {level === 'merchants' && node.invoiceCount != null && (
                    <span>· {node.invoiceCount} invoice{node.invoiceCount === 1 ? '' : 's'}</span>
                  )}
                </span>
              </span>
              {locked && <Lock size={15} className="spend-bar-lock" />}
              {drillable && !locked && <ChevronRight size={16} className="spend-bar-chevron" />}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
