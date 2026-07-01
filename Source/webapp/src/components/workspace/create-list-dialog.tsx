'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ListChecks } from 'lucide-react'
import { Button, Checkbox, Input } from '@/components/ds'
import { useWorkspace } from './workspace-provider'
import { RegionPicker } from './region-picker'
import { createList, setListRegion, SHOPPING_LIST_CATEGORY_IDS, SHOPPING_LIST_CATEGORY_LABELS } from './list-data'

interface CreateListDialogProps {
  onClose: () => void
  // Called with the new list id after a successful create so the page can select it.
  onCreated: (id: string) => void
  isPremium: boolean
}

// Create modal for a shopping list. The active-list cap is enforced server-side
// (409). Category is required and locked for the life of the list (§10b) — item
// search only ever surfaces products under the chosen macro. Premium users can
// additionally pin the list to a region other than their own profile region.
export function CreateListDialog({ onClose, onCreated, isPremium }: CreateListDialogProps) {
  const { showToast } = useWorkspace()
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState<string>(SHOPPING_LIST_CATEGORY_IDS[0])
  const [overrideRegion, setOverrideRegion] = useState(false)
  // Defaults to the launch market so the collapsed RegionPicker label isn't blank
  // on first show; "Modify" lets the user pick a specific region from there.
  const [country, setCountry] = useState('NL')
  const [region, setRegion] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (typeof document === 'undefined') return null

  const canSubmit = name.trim() !== '' && !submitting && (!overrideRegion || (country !== '' && region !== ''))

  const submit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const id = await createList(name.trim(), categoryId)
      // The list already exists past this point — a region-override failure is a
      // degraded success, not a full failure, so it must not report "couldn't
      // create" or skip onCreated/onClose (that would orphan an invisible list).
      if (overrideRegion) {
        try {
          await setListRegion(id, region, country)
          showToast('List created.', 'success')
        } catch {
          showToast('List created, but the region override couldn’t be saved — it’ll use your default region for now.', 'danger')
        }
      } else {
        showToast('List created.', 'success')
      }
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
            <p className="confirm-msg">Name it, pick a category, then add the things you need to buy.</p>
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

          <div className="filter-field">
            <label className="filter-label">Category</label>
            <div className="filter-tags" data-testid="list-category-radio">
              {SHOPPING_LIST_CATEGORY_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`filter-chip ${categoryId === id ? 'on' : ''}`}
                  onClick={() => setCategoryId(id)}
                  data-testid={`list-category-${id}`}
                >
                  {SHOPPING_LIST_CATEGORY_LABELS[id]}
                </button>
              ))}
            </div>
            <p className="optimizer-hint">Locked once the list is created — item search only shows products in this category.</p>
          </div>

          {isPremium && (
            <div className="filter-field">
              <Checkbox
                checked={overrideRegion}
                onChange={(e) => setOverrideRegion(e.target.checked)}
                label="Use a different region for this list (Premium)"
                data-testid="list-region-override-toggle"
              />
              {overrideRegion && (
                <RegionPicker
                  countryCode={country}
                  regionCode={region}
                  onChange={(c, r) => { setCountry(c); setRegion(r) }}
                />
              )}
            </div>
          )}
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
