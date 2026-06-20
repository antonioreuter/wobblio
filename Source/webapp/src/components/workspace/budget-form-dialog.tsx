'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Target } from 'lucide-react'
import { Button, Input } from '@/components/ds'
import { FilterSelect } from './filter-select'
import { useWorkspace } from './workspace-provider'
import {
  type Budget,
  type BudgetPeriod,
  type BudgetScope,
  type Category,
  type HouseholdMemberLite,
} from './budget-data'

interface BudgetFormDialogProps {
  mode: 'create' | 'edit'
  initial?: Budget
  categories: Category[]
  members: HouseholdMemberLite[]
  isHouseholdOwner: boolean
  onClose: () => void
}

// Create/edit modal for a budget definition. Create exposes the full scope set;
// edit is limited to amount + period to match the backend PATCH contract. Submit
// is self-contained (mirrors the delete flow): POST/PATCH, surface server errors
// via toast, refetch budgets, then close.
export function BudgetFormDialog({
  mode,
  initial,
  categories,
  members,
  isHouseholdOwner,
  onClose,
}: BudgetFormDialogProps) {
  const { showToast, refreshBudgets } = useWorkspace()

  const [scope, setScope] = useState<BudgetScope>(initial?.scope ?? 'TOTAL')
  const [categoryId, setCategoryId] = useState<string>(initial?.categoryId ?? '')
  const [memberUserId, setMemberUserId] = useState<string>(initial?.memberUserId ?? '')
  const [period, setPeriod] = useState<BudgetPeriod>(initial?.period ?? 'MONTH')
  const [amount, setAmount] = useState<string>(initial ? String(initial.amount) : '')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (typeof document === 'undefined') return null

  const amountValue = Number(amount)
  const amountValid = amount.trim() !== '' && amountValue > 0
  const scopeValid =
    scope === 'TOTAL' ||
    scope === 'HOUSEHOLD' ||
    (scope === 'CATEGORY' && categoryId !== '') ||
    (scope === 'MEMBER' && memberUserId !== '')
  const canSubmit = amountValid && scopeValid && !submitting

  const submit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const res = mode === 'create'
        ? await fetch('/api/budgets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              scope,
              categoryId:
                scope === 'CATEGORY' || scope === 'HOUSEHOLD' ? categoryId || null : null,
              memberUserId: scope === 'MEMBER' ? memberUserId : null,
              amount: amountValue,
              period,
            }),
          })
        : await fetch(`/api/budgets/${initial!.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: amountValue, period }),
          })

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string }
        showToast(body.message ?? 'Couldn’t save the budget — please try again.', 'danger')
        return
      }

      await refreshBudgets()
      showToast(mode === 'create' ? 'Budget created.' : 'Budget updated.', 'success')
      onClose()
    } catch {
      showToast('Couldn’t save the budget — please try again.', 'danger')
    } finally {
      setSubmitting(false)
    }
  }

  // CATEGORY pickers list top-level macro categories; MEMBER offered only to
  // household owners with a roster (the backend rejects it otherwise).
  const macroCategories = categories.filter((c) => c.parentId === null)
  const memberScopeAvailable = isHouseholdOwner && members.length > 0

  return createPortal(
    <div className="modal-overlay" onClick={onClose} data-testid="budget-form-dialog">
      <div
        className="confirm-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button type="button" className="dialog-close" aria-label="Close" onClick={onClose}>
          ✕
        </button>
        <div className="confirm-top">
          <div className="confirm-icon"><Target size={20} /></div>
          <div className="confirm-head">
            <h3 className="confirm-title">{mode === 'create' ? 'New budget' : 'Edit budget'}</h3>
            <p className="confirm-msg">
              {mode === 'create'
                ? 'Set a spending limit and we’ll alert you at 85% and 100%.'
                : 'Adjust the limit or period for this budget.'}
            </p>
          </div>
        </div>

        <div className="budget-form">
          {mode === 'create' && (
            <FilterSelect
              label="Scope"
              value={scope}
              onChange={(e) => setScope(e.target.value as BudgetScope)}
            >
              <option value="TOTAL">All spending</option>
              <option value="CATEGORY">A category</option>
              {isHouseholdOwner && <option value="HOUSEHOLD">Whole household</option>}
              {memberScopeAvailable && <option value="MEMBER">A household member</option>}
            </FilterSelect>
          )}

          {mode === 'create' && (scope === 'CATEGORY' || scope === 'HOUSEHOLD') && (
            <FilterSelect
              label="Category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">
                {scope === 'HOUSEHOLD' ? 'All categories' : 'Select a category…'}
              </option>
              {macroCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </FilterSelect>
          )}

          {mode === 'create' && scope === 'MEMBER' && (
            <FilterSelect
              label="Member"
              value={memberUserId}
              onChange={(e) => setMemberUserId(e.target.value)}
            >
              <option value="">Select a member…</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>{m.fullName || m.email}</option>
              ))}
            </FilterSelect>
          )}

          <FilterSelect
            label="Period"
            value={period}
            onChange={(e) => setPeriod(e.target.value as BudgetPeriod)}
          >
            <option value="MONTH">Monthly</option>
            <option value="WEEK">Weekly</option>
          </FilterSelect>

          <Input
            label="Limit (€)"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div className="confirm-actions">
          <button type="button" className="btn btn--outline" onClick={onClose}>
            Cancel
          </button>
          <Button onClick={submit} disabled={!canSubmit} data-testid="budget-form-submit">
            {submitting ? 'Saving…' : mode === 'create' ? 'Create budget' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
