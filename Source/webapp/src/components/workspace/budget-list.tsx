'use client'

import { Pencil, Trash2 } from 'lucide-react'
import { Money, ProgressBar } from '@/components/ds'
import { fmtDate } from './invoice-data'
import {
  type Budget,
  budgetPercent,
  periodLabel,
  scopeLabel,
} from './budget-data'

interface BudgetListProps {
  budgets: Budget[]
  categories: Map<string, string>
  members: Map<string, string>
  onEdit: (b: Budget) => void
  onDelete: (b: Budget) => void
}

export function BudgetList({ budgets, categories, members, onEdit, onDelete }: BudgetListProps) {
  return (
    <div className="budget-list" data-testid="budget-list">
      {budgets.map((b) => {
        const pct = budgetPercent(b)
        const tone = pct >= 100 ? 'danger' : pct >= 85 ? 'warning' : 'success'
        const name = scopeLabel(b, categories, members)
        return (
          <div className="budget-row" key={b.id} data-testid="budget-row">
            <div className="budget-row-head">
              <div className="budget-row-id">
                <span className="budget-row-name">{name}</span>
                <span className="budget-row-period">{periodLabel(b.period)}</span>
              </div>
              <div className="budget-row-actions">
                <button
                  type="button"
                  className="btn-icon"
                  aria-label={`Edit ${name} budget`}
                  onClick={() => onEdit(b)}
                  data-testid="budget-edit"
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  className="btn-icon"
                  aria-label={`Delete ${name} budget`}
                  onClick={() => onDelete(b)}
                  data-testid="budget-delete"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            <ProgressBar value={pct} tone={tone} ariaLabel={`${name} ${pct}%`} animate />

            <div className="budget-row-foot">
              <span className="budget-row-amount tabular">
                <Money amount={b.accumulated} /> <span className="budget-row-of">of</span>{' '}
                <Money amount={b.amount} />
              </span>
              <span className={`budget-row-pct budget-row-pct--${tone} tabular`}>{pct}%</span>
            </div>

            {(b.alert85At || b.alert100At) && (
              <p className="budget-row-alerts">
                {b.alert85At && <span>85% reached {fmtDate(b.alert85At)}</span>}
                {b.alert85At && b.alert100At && <span aria-hidden> · </span>}
                {b.alert100At && <span>Over budget {fmtDate(b.alert100At)}</span>}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
