'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import { TREND_PRODUCTS, MAX_PRODUCTS } from './trend-data'

interface ProductSearchProps {
  onAdd: (id: string) => void
  disabled: boolean
  exclude: string[]
}

export function ProductSearch({ onAdd, disabled, exclude }: ProductSearchProps) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const query = q.trim().toLowerCase()
  const matches = query
    ? TREND_PRODUCTS
        .filter((p) => !exclude.includes(p.id) && (p.name.toLowerCase().includes(query) || p.short.toLowerCase().includes(query)))
        .slice(0, 8)
    : []

  const pick = (id: string) => { onAdd(id); setQ(''); setOpen(false) }

  return (
    <div className="filter-field typeahead-field">
      <label className="filter-label">Find a product</label>
      <div className="filter-wrap">
        <span className="lead-icon"><Search size={15} /></span>
        <input
          className="filter-select ta-input"
          type="text"
          disabled={disabled}
          placeholder={disabled ? `Maximum of ${MAX_PRODUCTS} products` : 'Type a product name…'}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && matches[0]) {
              e.preventDefault()
              pick(matches[0].id)
            }
          }}
          data-testid="trend-product-search"
        />
      </div>
      {open && !disabled && query && (
        <div className="typeahead">
          {matches.length === 0 ? (
            <div className="typeahead-empty">No products match “{q}”.</div>
          ) : (
            matches.map((p) => (
              <button
                key={p.id}
                type="button"
                className="typeahead-opt"
                onMouseDown={(e) => { e.preventDefault(); pick(p.id) }}
              >
                <span className="ta-name">{p.name}</span>
                <span className="ta-stores">{p.stores.length} stores</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
