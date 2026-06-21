'use client'

import { useEffect, useState } from 'react'

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
}

export interface TrendComparison {
  countryCode: string
  regionCode: string
  weeks: number
  lines: TrendLine[]
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
