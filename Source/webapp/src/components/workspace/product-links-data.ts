'use client'

import type { SeriesSize } from './use-price-trends'

// Fix 10 product-link client layer. Cross-merchant comparability is a silent, tenant-scoped user
// assertion (RLS on the backend), recorded from the trend report's suggestion chips — no managed
// sets. All calls proxy through the BFF (/api/price-trends/suggestions, /api/me/product-links).

// One counterpart chip: a concrete (product @ merchant) the user can add to the chart in one tap.
// `linked` marks an already-accepted relationship (rendered first, with a link glyph).
export interface CounterpartSuggestion {
  productId: string
  displayName: string
  brand: string | null
  merchantId: string | null
  merchantName: string | null
  size: SeriesSize
  linked: boolean
}

// An accepted cross-merchant link among the selected products; drives the trend size-confirm prompt.
export interface LinkedPair {
  productAId: string
  productBId: string
  sizeEquivalent: boolean
}

const jsonHeaders = { 'Content-Type': 'application/json' }

export async function fetchProductLinks(productIds: string[], signal?: AbortSignal): Promise<LinkedPair[]> {
  if (productIds.length < 2) return []
  const params = new URLSearchParams({ products: productIds.join(',') })
  const res = await fetch(`/api/me/product-links?${params.toString()}`, { cache: 'no-store', signal })
  if (!res.ok) return []
  return ((await res.json()) as { links: LinkedPair[] }).links ?? []
}

export async function fetchSuggestions(
  productId: string,
  countryCode: string,
  regionCode: string,
  signal?: AbortSignal,
): Promise<CounterpartSuggestion[]> {
  const params = new URLSearchParams({ productId, country: countryCode, region: regionCode })
  const res = await fetch(`/api/price-trends/suggestions?${params.toString()}`, { cache: 'no-store', signal })
  if (!res.ok) return []
  return ((await res.json()) as { suggestions: CounterpartSuggestion[] }).suggestions ?? []
}

// Tap "+ add" on a suggestion → accept the pair (plotted, rankable subject to the comparability rule).
export function acceptLink(selfProductId: string, otherProductId: string): Promise<boolean> {
  return setLinkStatus(selfProductId, otherProductId, 'ACCEPTED')
}

// Tap "✕" on a suggestion → dismiss the pair (never suggested again, both directions).
export function dismissLink(selfProductId: string, otherProductId: string): Promise<boolean> {
  return setLinkStatus(selfProductId, otherProductId, 'DISMISSED')
}

async function setLinkStatus(selfProductId: string, otherProductId: string, status: 'ACCEPTED' | 'DISMISSED'): Promise<boolean> {
  const res = await fetch('/api/me/product-links', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ selfProductId, otherProductId, status }),
  })
  return res.ok
}

// "Same size?" confirmed on a plotted linked pair — the sole override to the comparability rule.
export async function setLinkSizeEquivalent(selfProductId: string, otherProductId: string, sizeEquivalent: boolean): Promise<boolean> {
  const res = await fetch('/api/me/product-links', {
    method: 'PATCH',
    headers: jsonHeaders,
    body: JSON.stringify({ selfProductId, otherProductId, sizeEquivalent }),
  })
  return res.ok
}
