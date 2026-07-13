'use client'

import { useEffect, useState } from 'react'

// Evidence state for a series' descriptive pack size (fix 09/01). Prices are always the pack
// price paid — never per-unit; size is a chip, not a comparison basis.
export type SizeSource = 'RECEIPT' | 'USER' | null

export interface SeriesSize {
  sizeText: string | null // e.g. "2L", "500g"; null when the size is unknown
  sizeSource: SizeSource
}

export interface TrendPoint {
  weekStart: string // ISO date (Monday)
  median: number | null
  discountMedian: number | null
}

export interface TrendLine {
  productId: string
  merchantId: string
  merchantName: string
  points: TrendPoint[]
  observationCount: number
  lastObservedOn: string
  stale: boolean
  staleDays: number
  size: SeriesSize
  // 09/05: the (product, merchant) name may cover different SKUs (bimodal history). Drives the
  // "prices ranged €X–€Y" banner; such a series is never crowned or fed to the optimizer.
  ambiguous: boolean
}

// The caller's own purchase history for a product — RLS-scoped, no quorum gate, so it
// shows even when the public (market) line is still below k≥3. Keyed by product only.
export interface OwnPurchaseLine {
  productId: string
  points: TrendPoint[]
  purchaseCount: number
  lastPurchasedOn: string
  // The two most recent regular-price purchase events (§6.5.5) — drive the "last paid · ▲/▼ N% vs
  // previous scan" legend copy. previousPrice is null when the product was bought only once.
  lastPrice: number | null
  previousPrice: number | null
  size: SeriesSize
}

export interface TrendComparison {
  countryCode: string
  regionCode: string
  weeks: number
  // The single ISO-4217 currency the whole view is filtered to and rendered in (§6.5 currency
  // honesty). Country-derived or the region's modal currency; null only when no data to infer one.
  currency: string | null
  // Pre-gate count of merchants tracking a selected product in the region — drives the cold-start
  // "N stores tracked in your area" motivator. 0 for non-Premium or nothing tracked yet.
  regionMerchantCount: number
  lines: TrendLine[] // public market trend — empty for non-Premium callers
  ownHistory: OwnPurchaseLine[] // the caller's own purchases — always present
}

export interface PriceTrends {
  comparison: TrendComparison | null
  loading: boolean
  forbidden: boolean // backend 403 — non-Premium (the page also gates client-side)
}

// Fetches the §6.5.1 comparison for the selected products in a given region. The
// backend already applies the k≥3 suppression and staleness flags; this hook only
// transports them. No products → no request, empty result.
export function usePriceTrends(
  productIds: string[],
  countryCode: string,
  regionCode: string,
  enabled: boolean,
): PriceTrends {
  const [comparison, setComparison] = useState<TrendComparison | null>(null)
  const [loading, setLoading] = useState(false)
  const [forbidden, setForbidden] = useState(false)

  const key = `${productIds.join(',')}|${countryCode}|${regionCode}`

  useEffect(() => {
    if (!enabled || productIds.length === 0 || !countryCode || !regionCode) {
      setComparison(null)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    setForbidden(false)
    const params = new URLSearchParams({
      products: productIds.join(','),
      country: countryCode,
      region: regionCode,
    })
    fetch(`/api/price-trends/comparison?${params.toString()}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (r) => {
        if (r.status === 403) {
          setForbidden(true)
          return null
        }
        return r.ok ? ((await r.json()) as TrendComparison) : null
      })
      .then((data) => setComparison(data))
      .catch(() => undefined)
      .finally(() => setLoading(false))
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled])

  return { comparison, loading, forbidden }
}
