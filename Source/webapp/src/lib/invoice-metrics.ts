import { MONTHS, type Invoice } from '@/components/workspace/invoice-data'

export interface SpendMetrics {
  thisMonth: number
  lastMonth: number
  deltaPct: number | null // % change vs last month; null when there is no prior-month spend
  topMerchant: { name: string; total: number } | null
  series: { month: string; total: number }[] // trailing 6 months including the current one
}

const monthKey = (d: Date): number => d.getUTCFullYear() * 12 + d.getUTCMonth()

export function computeSpendMetrics(invoices: Invoice[], now: Date): SpendMetrics {
  const thisKey = monthKey(now)
  const lastKey = thisKey - 1

  let thisMonth = 0
  let lastMonth = 0
  const byMerchant = new Map<string, number>()
  const byMonth = new Map<number, number>()

  for (const inv of invoices) {
    const key = monthKey(new Date(inv.dateISO))
    byMonth.set(key, (byMonth.get(key) ?? 0) + inv.total)
    if (key === thisKey) {
      thisMonth += inv.total
      byMerchant.set(inv.merchant, (byMerchant.get(inv.merchant) ?? 0) + inv.total)
    }
    if (key === lastKey) lastMonth += inv.total
  }

  let topMerchant: SpendMetrics['topMerchant'] = null
  for (const [name, total] of byMerchant) {
    if (!topMerchant || total > topMerchant.total) topMerchant = { name, total }
  }

  const series = Array.from({ length: 6 }, (_, i) => {
    const offset = 5 - i
    const m = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1))
    return { month: MONTHS[m.getUTCMonth()], total: byMonth.get(monthKey(m)) ?? 0 }
  })

  return {
    thisMonth,
    lastMonth,
    deltaPct: lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : null,
    topMerchant,
    series,
  }
}
