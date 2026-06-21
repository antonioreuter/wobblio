// Deterministic mock data lifted from Wobblio Design System / kit-workspace.jsx.
// Replace with real backend wiring once ingestion API lands.

export type StatusTone = 'success' | 'warning' | 'primary' | 'danger'
export type Status = [StatusTone, string]

export type LocationStatus = 'RESOLVED' | 'PENDING' | 'HELD_UNMAPPED'

export interface Invoice {
  id: string
  merchant: string
  category: string
  dateISO: string
  status: Status
  tags: string[]
  // Free-text receipt city, searchable but never rendered as a tag chip.
  searchCity: string | null
  total: number
  locationStatus: LocationStatus
  locationCountryCode: string | null
  locationRegionCode: string | null
  // Whether the receipt is parsed enough to confirm a location (PARSED/NEEDS_REVIEW).
  // Duplicates and in-flight invoices can be PENDING but must not show the prompt.
  locationConfirmable: boolean
}

// A parsed receipt whose prices are held out of the regional index until the user
// confirms where they shopped (§6.5). Mirrors InvoiceLocationGate's render gate:
// HELD_UNMAPPED has nothing for the user to do, so only PENDING + confirmable counts.
export const needsLocationConfirmation = (inv: Invoice): boolean =>
  inv.locationStatus === 'PENDING' && inv.locationConfirmable

export type Preset = '30d' | 'month' | '90d' | 'custom'

export interface FilterDraft {
  category: string
  merchant: string
  preset: Preset
  status: string
  from: string
  to: string
  tags: string[]
}

export const TODAY = new Date('2026-06-13')
export const CATEGORIES = ['Groceries', 'Bar & Restaurants', 'Transport', 'Drugstore', 'Others']
export const MERCHANTS = [
  'Albert Heijn',
  'AH To Go',
  'Jumbo Oostpoort',
  'Dirk van den Broek',
  'Lidl',
  'Tokomania',
  'Restaurante Cantinho',
]
export const STATUSES: Status[] = [
  ['success', 'Ready'],
  ['warning', 'Possible duplicate'],
]
export const TAG_POOL = ['dinner', 'weekly', 'commute', 'pantry', 'treat', 'household', 'fuel', 'organic']
export const ALL_TAGS = TAG_POOL

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const fmtDate = (iso: string): string => {
  const d = new Date(iso)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}
export const eur = (n: number): string => '€' + n.toFixed(2)
export const daysAgo = (n: number): Date => {
  const d = new Date(TODAY)
  d.setDate(d.getDate() - n)
  return d
}

function buildInvoices(): Invoice[] {
  const out: Invoice[] = []
  let day = 1
  for (let k = 0; k < 42; k++) {
    const d = new Date(TODAY)
    d.setDate(d.getDate() - day)
    const tags = [...new Set([TAG_POOL[k % TAG_POOL.length], TAG_POOL[(k * 2 + 1) % TAG_POOL.length]])]
    out.push({
      id: String(k + 1),
      merchant: MERCHANTS[(k * 3) % MERCHANTS.length],
      category: CATEGORIES[k % CATEGORIES.length],
      dateISO: d.toISOString().slice(0, 10),
      status: STATUSES[k % STATUSES.length],
      tags,
      searchCity: null,
      total: Math.round((8 + ((k * 7.37) % 72)) * 100) / 100,
      locationStatus: 'RESOLVED',
      locationCountryCode: null,
      locationRegionCode: null,
      locationConfirmable: true,
    })
    day += 1 + (k % 3)
  }
  return out
}
export const INVOICE_DB: Invoice[] = buildInvoices()

export const SPEND: Array<[string, number, number]> = [
  ['Groceries', 248.6, 150],
  ['Bar & Restaurants', 162.4, 98],
  ['Transport', 98.2, 59],
  ['Drugstore', 74.8, 45],
  ['Others', 58.3, 35],
]

// Trailing 6 months of total spend; the final point (June) is the current MTD
// figure (€642.30) and May matches the "vs €728.42 last month" delta.
export const SPEND_OVER_TIME: Array<{ month: string; total: number }> = [
  { month: 'Jan', total: 712.4 },
  { month: 'Feb', total: 689.15 },
  { month: 'Mar', total: 754.8 },
  { month: 'Apr', total: 701.2 },
  { month: 'May', total: 728.42 },
  { month: 'Jun', total: 642.3 },
]

export const PRESETS: Array<[Preset, string]> = [
  ['30d', 'Last 30 days'],
  ['month', 'This month'],
  ['90d', 'Last 3 months'],
  ['custom', 'Custom range'],
]

export const BLANK: FilterDraft = {
  category: 'all',
  merchant: 'all',
  preset: '90d',
  status: 'all',
  from: '',
  to: '',
  tags: [],
}

export const PAGE_SIZE = 8
export const INVOICES_THIS_WEEK = 9
export const WEEKLY_LIMIT = 15
