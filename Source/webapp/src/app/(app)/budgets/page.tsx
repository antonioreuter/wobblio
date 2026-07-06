'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Crown, Plus, Target } from 'lucide-react'
import { Button, Card } from '@/components/ds'
import {
  BudgetFormDialog,
  BudgetList,
  ConfirmDialog,
  MAX_BUDGETS,
  scopeLabel,
  useBudgetReference,
  useWorkspace,
  type Budget,
} from '@/components/workspace'

export default function BudgetsPage() {
  const { data: session } = useSession()
  const { budgets, loading, showToast, refreshBudgets } = useWorkspace()
  // PREMIUM plus the elevated operator roles (ADMIN, TESTER) get full access.
  const role = session?.user?.role
  const isPremium = !!role && role !== 'STANDARD'

  const { categories, members, isHouseholdOwner, categoryNames, memberNames } =
    useBudgetReference(isPremium, session?.user?.email)

  const [creating, setCreating] = useState(false)
  const [editTarget, setEditTarget] = useState<Budget | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Budget | null>(null)

  const deleteBudget = async () => {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    try {
      const res = await fetch(`/api/budgets/${target.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(String(res.status))
      await refreshBudgets()
      showToast('Budget deleted.', 'danger')
    } catch {
      showToast('Couldn’t delete the budget — please try again.', 'danger')
    }
  }

  if (!isPremium) {
    return (
      <div className="pane">
        <h2 className="pane-title">Budgets</h2>
        <p className="pane-subtitle">Set spending limits and get alerted before you overspend.</p>
        <Card className="panel budget-upsell" data-testid="budget-upsell">
          <div className="budget-upsell-icon"><Crown size={22} /></div>
          <h3 className="budget-upsell-title">Budgets are a Premium feature</h3>
          <p className="budget-upsell-body">
            Premium unlocks up to {MAX_BUDGETS} budgets across total spend, categories, and household
            members — with automatic alerts at 85% and 100% of each limit.
          </p>
        </Card>
      </div>
    )
  }

  const atLimit = budgets.length >= MAX_BUDGETS

  return (
    <div className="pane">
      <div className="pane-head-row">
        <div>
          <h2 className="pane-title">Budgets</h2>
          <p className="pane-subtitle">
            Spending limits with alerts at 85% and 100%.{' '}
            <span className="tabular">{budgets.length}</span> / {MAX_BUDGETS} used.
          </p>
        </div>
        <Button
          iconLeft={<Plus size={15} />}
          onClick={() => setCreating(true)}
          disabled={atLimit}
          data-testid="budget-create"
        >
          New budget
        </Button>
      </div>

      <Card className="panel">
        {loading ? (
          <div className="budget-list">
            {[0, 1, 2].map((i) => (
              <div className="budget-row" key={i}>
                <span className="sk sk-line" style={{ width: 140, height: 13 }} />
                <span className="sk sk-line" style={{ width: '100%', height: 8, marginTop: 14 }} />
                <span className="sk sk-line" style={{ width: 120, height: 11, marginTop: 12 }} />
              </div>
            ))}
          </div>
        ) : budgets.length === 0 ? (
          <div className="budget-empty" data-testid="budget-empty">
            <div className="budget-empty-icon"><Target size={20} /></div>
            <p className="budget-empty-title">No budgets yet</p>
            <p className="budget-empty-body">
              Create your first budget to start tracking spending against a limit.
            </p>
          </div>
        ) : (
          <BudgetList
            budgets={budgets}
            categories={categoryNames}
            members={memberNames}
            onEdit={setEditTarget}
            onDelete={setDeleteTarget}
          />
        )}
      </Card>

      {(creating || editTarget) && (
        <BudgetFormDialog
          mode={editTarget ? 'edit' : 'create'}
          initial={editTarget ?? undefined}
          categories={categories}
          members={members}
          isHouseholdOwner={isHouseholdOwner}
          onClose={() => {
            setCreating(false)
            setEditTarget(null)
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete this budget?"
          message={`The ${scopeLabel(deleteTarget, categoryNames, memberNames)} budget (€${deleteTarget.amount.toFixed(2)}) will be removed. This can’t be undone.`}
          confirmLabel="Delete budget"
          onConfirm={deleteBudget}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
