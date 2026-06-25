'use client'

import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'

interface ApiProduct {
  productId: string
  displayName: string
  brand: string | null
}

interface AddItemRowProps {
  // freeText is always sent; productId resolves the item to a catalog product
  // (and lets the optimizer price it). null = a plain free-text item.
  onAdd: (freeText: string, productId: string | null) => Promise<void>
  disabled: boolean
}

const MIN_QUERY = 2
const DEBOUNCE_MS = 250

// Add-item field for a shopping list. Mirrors ProductSearch's typeahead against
// /api/products/search (ACTIVE ∪ own-PROVISIONAL), but Enter adds the typed text
// as a free-text item — shoppers often jot things the catalog doesn't have yet.
// Picking a suggestion resolves the item to that product.
export function AddItemRow({ onAdd, disabled }: AddItemRowProps) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<ApiProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const query = q.trim()

  useEffect(() => {
    if (query.length < MIN_QUERY) {
      setResults([])
      return
    }
    const controller = new AbortController()
    setLoading(true)
    const timer = setTimeout(() => {
      fetch(`/api/products/search?q=${encodeURIComponent(query)}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
        .then((r) => (r.ok ? r.json() : { products: [] }))
        .then((d: { products: ApiProduct[] }) => setResults(d.products ?? []))
        .catch(() => undefined)
        .finally(() => setLoading(false))
    }, DEBOUNCE_MS)
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [query])

  const matches = results.slice(0, 8)
  const inputDisabled = disabled || busy

  const commit = async (freeText: string, productId: string | null) => {
    const text = freeText.trim()
    if (!text || busy) return
    setBusy(true)
    try {
      await onAdd(text, productId)
      setQ('')
      setResults([])
      setOpen(false)
      inputRef.current?.focus()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="filter-field typeahead-field list-add">
      <div className="filter-wrap">
        <span className="lead-icon"><Plus size={15} /></span>
        <input
          ref={inputRef}
          className="filter-select ta-input"
          type="text"
          disabled={inputDisabled}
          placeholder="Add an item…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit(q, null)
            }
          }}
          data-testid="list-add-item"
        />
      </div>
      {open && !inputDisabled && query.length >= MIN_QUERY && (
        <div className="typeahead">
          {loading && matches.length === 0 ? (
            <div className="typeahead-empty">Searching…</div>
          ) : (
            <>
              <button
                type="button"
                className="typeahead-opt"
                onMouseDown={(e) => { e.preventDefault(); commit(q, null) }}
              >
                <span className="ta-name">Add “{query}”</span>
                <span className="ta-stores">free text</span>
              </button>
              {matches.map((p) => (
                <button
                  key={p.productId}
                  type="button"
                  className="typeahead-opt"
                  onMouseDown={(e) => { e.preventDefault(); commit(p.displayName, p.productId) }}
                >
                  <span className="ta-name">{p.displayName}</span>
                  {p.brand && <span className="ta-stores">{p.brand}</span>}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
