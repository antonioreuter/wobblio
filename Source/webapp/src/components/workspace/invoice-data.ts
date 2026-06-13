// Deterministic mock data lifted from Wobblio Design System / kit-workspace.jsx.
// Replace with real backend wiring once ingestion API lands.

export type StatusTone = 'success' | 'warning' | 'primary' | 'danger'
export type Status = [StatusTone, string]

export interface Invoice {
  id: number
  merchant: string
  category: string
  dateISO: string
  status: Status
  tags: string[]
  total: number
}

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
  ['success', 'Processed'],
  ['warning', 'Needs Review'],
  ['primary', 'Auto Parsed'],
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
      id: k + 1,
      merchant: MERCHANTS[(k * 3) % MERCHANTS.length],
      category: CATEGORIES[k % CATEGORIES.length],
      dateISO: d.toISOString().slice(0, 10),
      status: STATUSES[k % STATUSES.length],
      tags,
      total: Math.round((8 + ((k * 7.37) % 72)) * 100) / 100,
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

export const BUDGETS: Array<{ name: string; pct: number }> = [
  { name: 'Groceries', pct: 76 },
  { name: 'Bar & Restaurants', pct: 104 },
  { name: 'Transport', pct: 51 },
  { name: 'Drugstore', pct: 88 },
]

export type BudgetTone = 'success' | 'warning' | 'danger'
export const budgetColor = (pct: number): BudgetTone =>
  pct >= 100 ? 'danger' : pct >= 85 ? 'warning' : 'success'

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
