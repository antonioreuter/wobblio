import { MONTHS, type Invoice } from '@/components/workspace/invoice-data'

export interface SpendMetrics {
  thisMonth: number
  lastMonth: number
  deltaPct: number | null // % change vs last month; null when there is no prior-month spend
  series: { month: string; total: number }[] // trailing 6 months including the current one
}

const monthKey = (d: Date): number => d.getUTCFullYear() * 12 + d.getUTCMonth()

export function computeSpendMetrics(invoices: Invoice[], now: Date): SpendMetrics {
  const thisKey = monthKey(now)
  const lastKey = thisKey - 1

  let thisMonth = 0
  let lastMonth = 0
  const byMonth = new Map<number, number>()

  for (const inv of invoices) {
    const key = monthKey(new Date(inv.dateISO))
    byMonth.set(key, (byMonth.get(key) ?? 0) + inv.total)
    if (key === thisKey) thisMonth += inv.total
    if (key === lastKey) lastMonth += inv.total
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
    series,
  }
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Daily spend series for the current month (day by day up to today)
export function computeDailySeriesForMonth(
  invoices: Invoice[],
  now: Date
): { day: string; total: number; isWeekend: boolean; weekday: string; dateLabel: string }[] {
  const currentMonth = now.getUTCMonth()
  const currentYear = now.getUTCFullYear()
  const daysInMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 0)).getUTCDate()

  const byDay = new Map<number, number>()

  for (const inv of invoices) {
    const d = new Date(inv.dateISO)
    if (d.getUTCMonth() === currentMonth && d.getUTCFullYear() === currentYear) {
      const day = d.getUTCDate()
      byDay.set(day, (byDay.get(day) ?? 0) + inv.total)
    }
  }

  // Return series for each day from 1 to today (or last day if today is past month-end)
  const lastDay = Math.min(now.getUTCDate(), daysInMonth)
  return Array.from({ length: lastDay }, (_, i) => {
    const day = i + 1
    const date = new Date(Date.UTC(currentYear, currentMonth, day))
    const dayOfWeek = date.getUTCDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const weekday = WEEKDAYS[dayOfWeek]
    const dateLabel = `${weekday}, ${MONTHS[currentMonth]} ${day}`
    return {
      day: String(day),
      total: byDay.get(day) ?? 0,
      isWeekend,
      weekday,
      dateLabel,
    }
  })
}
