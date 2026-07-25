'use client'

import { useEffect, useRef, useState } from 'react'
import { Link2, Plus } from 'lucide-react'
import { fetchSuggestions, acceptLink, dismissLink, type CounterpartSuggestion } from './product-links-data'
import type { TrendProduct } from './product-search'

interface AnchoredSuggestion {
  anchorId: string // the selected product this counterpart was suggested for (self side of the link)
  s: CounterpartSuggestion
}

const SUGGEST_DEBOUNCE_MS = 200

// Fix 10 — one-tap counterpart chips under the product picker. For each selected product we ask the
// backend for same-category, cross-merchant products tracked in the region; the user adds one with a
// tap (which also records the link) or dismisses it for good. Replaces the whole comparison-sets flow:
// no second search, no set to manage, no blocking "same size?" prompt.
export function TrendSuggestions({
  selectedIds,
  countryCode,
  regionCode,
  atMax,
  onAdd,
}: {
  selectedIds: string[]
  countryCode: string
  regionCode: string
  atMax: boolean
  onAdd: (product: TrendProduct) => void
}) {
  const [items, setItems] = useState<AnchoredSuggestion[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  // Per-anchor suggestion cache keyed by anchor+region, so adding a 2nd/3rd product doesn't re-query
  // the anchors already fetched (their counterparts don't change). Lives for the component's life.
  const cacheRef = useRef<Map<string, AnchoredSuggestion[]>>(new Map())
  const key = `${selectedIds.join(',')}|${countryCode}|${regionCode}`

  useEffect(() => {
    if (atMax || selectedIds.length === 0 || !countryCode || !regionCode) {
      setItems([])
      return
    }
    const controller = new AbortController()
    // Debounce so a fast add-then-add doesn't fire overlapping sweeps of the expensive query.
    const timer = setTimeout(() => {
      Promise.all(
        selectedIds.map(async (anchorId) => {
          const cacheKey = `${anchorId}|${countryCode}|${regionCode}`
          const cached = cacheRef.current.get(cacheKey)
          if (cached) return cached
          const suggestions = await fetchSuggestions(anchorId, countryCode, regionCode, controller.signal)
          const anchored = suggestions.map((s) => ({ anchorId, s }))
          cacheRef.current.set(cacheKey, anchored)
          return anchored
        }),
      )
      .then((perAnchor) => {
        // Dedupe across anchors (first wins) and never suggest an already-selected product; linked
        // (already-accepted) counterparts rank first.
        const seen = new Set<string>(selectedIds)
        const merged: AnchoredSuggestion[] = []
        for (const list of perAnchor) {
          for (const item of list) {
            if (seen.has(item.s.productId)) continue
            seen.add(item.s.productId)
            merged.push(item)
          }
        }
        merged.sort((a, b) => Number(b.s.linked) - Number(a.s.linked))
        setItems(merged)
      })
      .catch(() => undefined)
    }, SUGGEST_DEBOUNCE_MS)
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, atMax])

  const visible = items.filter((it) => !dismissed.has(it.s.productId) && !selectedIds.includes(it.s.productId))
  if (atMax || visible.length === 0) return null

  const onAddChip = async (it: AnchoredSuggestion) => {
    // Plot first and only persist the link when we'd actually add it, so a chip tapped at the
    // product cap (or for an already-selected product) never leaves an orphan ACCEPTED link.
    if (atMax || selectedIds.includes(it.s.productId)) return
    onAdd({ id: it.s.productId, name: it.s.displayName, brand: it.s.brand })
    await acceptLink(it.anchorId, it.s.productId)
  }
  const onDismissChip = async (it: AnchoredSuggestion) => {
    setDismissed((prev) => new Set(prev).add(it.s.productId))
    await dismissLink(it.anchorId, it.s.productId)
  }

  return (
    <div className="filter-field" style={{ marginTop: 8 }} data-testid="trend-suggestions">
      <label className="filter-label">Also sold nearby — tap to compare</label>
      <div className="trend-picker">
        {visible.map((it) => (
          <span className="trend-chip" style={{ borderStyle: 'dashed' }} key={it.s.productId} data-testid="trend-suggestion">
            {it.s.linked && <Link2 size={11} aria-label="already linked" />}
            {it.s.displayName} · <strong>{it.s.merchantName ?? 'store'}</strong>
            <button
              type="button"
              className="trend-x"
              aria-label={`Add ${it.s.displayName}`}
              onClick={() => onAddChip(it)}
              data-testid="trend-suggestion-add"
            >
              <Plus size={12} />
            </button>
            <button
              type="button"
              className="trend-x"
              aria-label={`Dismiss ${it.s.displayName}`}
              onClick={() => onDismissChip(it)}
              data-testid="trend-suggestion-dismiss"
            >
              ✕
            </button>
          </span>
        ))}
      </div>
    </div>
  )
}
