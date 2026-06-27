'use client'

import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { MAX_PRODUCTS } from './trend-data'

export interface TrendProduct {
  id: string
  name: string
  brand: string | null
}

interface ApiProduct {
  productId: string
  displayName: string
  brand: string | null
  ownMerchantCount: number
  ownMerchantName: string | null
  marketMerchantCount: number
  marketMerchantName: string | null
}

interface ProductSearchProps {
  onAdd: (product: TrendProduct) => void
  disabled: boolean
  exclude: string[]
  mode: 'own' | 'market'
  // Scope the market merchant signal to the region the trends chart serves.
  countryCode: string
  regionCode: string
}

// Store badge tracks the active compare mode: one store → its name; many → "N stores".
function storeSignal(p: ApiProduct, mode: 'own' | 'market'): string | null {
  const count = mode === 'market' ? p.marketMerchantCount : p.ownMerchantCount
  const name = mode === 'market' ? p.marketMerchantName : p.ownMerchantName
  if (count === 1) return name ?? p.brand
  if (count > 1) return `${count} stores`
  return p.brand
}

const MIN_QUERY = 2
const DEBOUNCE_MS = 250

// §10 product autocomplete against the real catalog (/api/products/search). Results
// are the caller's RLS-visible ACTIVE ∪ own-PROVISIONAL products; selecting one hands
// the parent {id, name} so the chip can show the product without a second lookup.
export function ProductSearch({ onAdd, disabled, exclude, mode, countryCode, regionCode }: ProductSearchProps) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<ApiProduct[]>([])
  const [loading, setLoading] = useState(false)
  const query = q.trim()

  useEffect(() => {
    if (query.length < MIN_QUERY) {
      setResults([])
      return
    }
    const controller = new AbortController()
    setLoading(true)
    const params = new URLSearchParams({ q: query })
    if (countryCode) params.set('country', countryCode)
    if (regionCode) params.set('region', regionCode)
    const timer = setTimeout(() => {
      fetch(`/api/products/search?${params.toString()}`, {
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
  }, [query, countryCode, regionCode])

  const matches = results.filter((p) => !exclude.includes(p.productId)).slice(0, 8)

  const pick = (p: ApiProduct) => {
    onAdd({ id: p.productId, name: p.displayName, brand: p.brand })
    setQ('')
    setResults([])
    setOpen(false)
  }

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
              pick(matches[0])
            }
          }}
          data-testid="trend-product-search"
        />
      </div>
      {open && !disabled && query.length >= MIN_QUERY && (
        <div className="typeahead">
          {loading && matches.length === 0 ? (
            <div className="typeahead-empty">Searching…</div>
          ) : matches.length === 0 ? (
            <div className="typeahead-empty">No products match “{q}”.</div>
          ) : (
            matches.map((p) => (
              <button
                key={p.productId}
                type="button"
                className="typeahead-opt"
                onMouseDown={(e) => { e.preventDefault(); pick(p) }}
              >
                <span className="ta-name">{p.displayName}</span>
                {storeSignal(p, mode) && <span className="ta-stores">{storeSignal(p, mode)}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
