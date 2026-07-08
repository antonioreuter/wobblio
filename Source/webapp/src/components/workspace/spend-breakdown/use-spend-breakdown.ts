'use client'

import { useEffect, useState } from 'react'

export type SpendLevel = 'categories' | 'merchants' | 'item-categories' | 'items'
export type SpendPreset = 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'LAST_90D' | 'CUSTOM'
// 'merchant' descends category → merchant → item-category → items; 'product' drops the merchant
// level (category → item-category → items across all stores) and shows the store on each leaf line.
export type SpendView = 'merchant' | 'product'

export interface SpendOccurrence {
  date: string
  invoiceId: string
  quantity: number
  amount: number
  merchantName: string | null
}

export interface SpendNode {
  id: string
  name: string
  amount: number
  pct: number
  count: number
  invoiceCount?: number
  lastPurchasedOn?: string | null
  quantity?: number
  occurrences?: SpendOccurrence[]
}

export interface SpendReport {
  level: SpendLevel
  currency: string | null
  total: number
  nodes: SpendNode[]
  categoryId?: string | null
  categoryName?: string | null
  merchantId?: string | null
  merchantName?: string | null
  itemCategoryId?: string | null
  itemCategoryName?: string | null
}

// The drill path. Level is derived from which ids are set (see selectionToQuery).
export interface SpendSelection {
  categoryId: string | null
  merchantId: string | null
  itemCategoryId: string | null
}

export interface SpendFilters {
  preset: SpendPreset
  from: string
  to: string
  country: string
  region: string // '' ⇒ all regions
  view: SpendView
}

export const EMPTY_SELECTION: SpendSelection = { categoryId: null, merchantId: null, itemCategoryId: null }

function selectionToQuery(selection: SpendSelection, filters: SpendFilters): string {
  const params = new URLSearchParams({ period: filters.preset, view: filters.view })
  if (filters.preset === 'CUSTOM' && filters.from && filters.to) {
    params.set('from', filters.from)
    params.set('to', filters.to)
  }
  if (filters.region) {
    params.set('country', filters.country)
    params.set('region', filters.region)
  }
  if (selection.categoryId) params.set('categoryId', selection.categoryId)
  if (selection.merchantId) params.set('merchantId', selection.merchantId)
  if (selection.itemCategoryId) params.set('itemCategoryId', selection.itemCategoryId)
  return params.toString()
}

export interface SpendBreakdownState {
  report: SpendReport | null
  loading: boolean
  forbidden: boolean // backend 403 — item level requires premium
  error: boolean
}

// Fetches the spend breakdown for the current selection + filters, refetching whenever they
// change and aborting the in-flight request so a fast drill doesn't render stale data.
export function useSpendBreakdown(
  selection: SpendSelection,
  filters: SpendFilters,
  enabled: boolean,
): SpendBreakdownState {
  const [state, setState] = useState<SpendBreakdownState>({
    report: null,
    loading: enabled,
    forbidden: false,
    error: false,
  })
  const qs = selectionToQuery(selection, filters)

  useEffect(() => {
    if (!enabled) {
      setState({ report: null, loading: false, forbidden: false, error: false })
      return
    }
    const controller = new AbortController()
    setState((s) => ({ ...s, loading: true, forbidden: false, error: false }))
    fetch(`/api/reports/spend?${qs}`, { cache: 'no-store', signal: controller.signal })
      .then(async (res) => {
        if (res.status === 403) {
          setState({ report: null, loading: false, forbidden: true, error: false })
          return
        }
        if (!res.ok) {
          setState({ report: null, loading: false, forbidden: false, error: true })
          return
        }
        const report = (await res.json()) as SpendReport
        setState({ report, loading: false, forbidden: false, error: false })
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return
        setState({ report: null, loading: false, forbidden: false, error: true })
      })
    return () => controller.abort()
  }, [qs, enabled])

  return state
}
