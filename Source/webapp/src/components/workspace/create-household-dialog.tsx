'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Users } from 'lucide-react'
import { Button, Input } from '@/components/ds'
import { useWorkspace } from './workspace-provider'

interface CreateHouseholdDialogProps {
  onClose: () => void
  // Called after a successful create so the page can reload its household state.
  onCreated: () => void
}

// Create modal for a household. PREMIUM gating is enforced server-side; this only
// collects a name. Mirrors BudgetFormDialog: self-contained POST, surface server
// errors via toast, then notify the page and close.
export function CreateHouseholdDialog({ onClose, onCreated }: CreateHouseholdDialogProps) {
  const { showToast } = useWorkspace()
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (typeof document === 'undefined') return null

  const canSubmit = name.trim() !== '' && !submitting

  const submit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/households', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string }
        showToast(body.message ?? 'Couldn’t create the household — please try again.', 'danger')
        return
      }
      showToast('Household created.', 'success')
      onCreated()
      onClose()
    } catch {
      showToast('Couldn’t create the household — please try again.', 'danger')
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose} data-testid="household-create-dialog">
      <div className="confirm-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button type="button" className="dialog-close" aria-label="Close" onClick={onClose}>
          ✕
        </button>
        <div className="confirm-top">
          <div className="confirm-icon"><Users size={20} /></div>
          <div className="confirm-head">
            <h3 className="confirm-title">New household</h3>
            <p className="confirm-msg">
              Share a weekly upload pool with up to 5 members. You’ll be the owner.
            </p>
          </div>
        </div>

        <div className="budget-form">
          <Input
            label="Household name"
            placeholder="e.g. The Jansens"
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="household-name-input"
          />
        </div>

        <div className="confirm-actions">
          <button type="button" className="btn btn--outline" onClick={onClose}>
            Cancel
          </button>
          <Button onClick={submit} disabled={!canSubmit} data-testid="household-create-submit">
            {submitting ? 'Creating…' : 'Create household'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
