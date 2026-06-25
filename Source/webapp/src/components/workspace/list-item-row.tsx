'use client'

import { useState } from 'react'
import { Check, Tag, Trash2 } from 'lucide-react'
import type { ListItem } from './list-data'

interface ListItemRowProps {
  item: ListItem
  onToggle: (checked: boolean) => void
  onEdit: (freeText: string) => void
  onRemove: () => void
}

// One shopping-list line: a checkbox (optimistic toggle handled by the parent),
// the item text (click to rename), a catalog badge when resolved to a product,
// and a remove action.
export function ListItemRow({ item, onToggle, onEdit, onRemove }: ListItemRowProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.freeText)

  const save = () => {
    const text = draft.trim()
    setEditing(false)
    if (text && text !== item.freeText) onEdit(text)
    else setDraft(item.freeText)
  }

  return (
    <div className={`list-item ${item.checked ? 'list-item--done' : ''}`} data-testid="list-item">
      <button
        type="button"
        role="checkbox"
        aria-checked={item.checked}
        aria-label={`Mark ${item.freeText} as ${item.checked ? 'not bought' : 'bought'}`}
        className={`list-check ${item.checked ? 'list-check--on' : ''}`}
        onClick={() => onToggle(!item.checked)}
        data-testid="list-item-check"
      >
        {item.checked && <Check size={13} strokeWidth={3} />}
      </button>

      {editing ? (
        <input
          className="list-item-edit"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') { setDraft(item.freeText); setEditing(false) }
          }}
          data-testid="list-item-edit"
        />
      ) : (
        <button
          type="button"
          className="list-item-text"
          onClick={() => { setDraft(item.freeText); setEditing(true) }}
          title="Rename item"
        >
          {item.freeText}
        </button>
      )}

      {item.productId && (
        <span className="list-item-tag" title="Matched to a catalog product">
          <Tag size={11} /> catalog
        </span>
      )}

      <button
        type="button"
        className="btn-icon list-item-remove"
        aria-label={`Remove ${item.freeText}`}
        onClick={onRemove}
        data-testid="list-item-remove"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}
