'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ListChecks } from 'lucide-react'
import { Button, Input } from '@/components/ds'
import { useWorkspace } from './workspace-provider'
import { createList } from './list-data'

interface CreateListDialogProps {
  onClose: () => void
  // Called with the new list id after a successful create so the page can select it.
  onCreated: (id: string) => void
}

// Create modal for a shopping list. The active-list cap is enforced server-side
// (409); this only collects a name. Mirrors CreateHouseholdDialog.
export function CreateListDialog({ onClose, onCreated }: CreateListDialogProps) {
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
      const id = await createList(name.trim())
      showToast('List created.', 'success')
      onCreated(id)
      onClose()
    } catch (err) {
      const atLimit = err instanceof Error && err.message === '409'
      showToast(
        atLimit
          ? 'You’ve reached your active-list limit. Complete a list to free a slot.'
          : 'Couldn’t create the list — please try again.',
        'danger',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose} data-testid="list-create-dialog">
      <div className="confirm-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button type="button" className="dialog-close" aria-label="Close" onClick={onClose}>
          ✕
        </button>
        <div className="confirm-top">
          <div className="confirm-icon"><ListChecks size={20} /></div>
          <div className="confirm-head">
            <h3 className="confirm-title">New shopping list</h3>
            <p className="confirm-msg">Name it, then add the things you need to buy.</p>
          </div>
        </div>

        <div className="budget-form">
          <Input
            label="List name"
            placeholder="e.g. Weekly groceries"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
            data-testid="list-name-input"
          />
        </div>

        <div className="confirm-actions">
          <button type="button" className="btn btn--outline" onClick={onClose}>
            Cancel
          </button>
          <Button onClick={submit} disabled={!canSubmit} data-testid="list-create-submit">
            {submitting ? 'Creating…' : 'Create list'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
