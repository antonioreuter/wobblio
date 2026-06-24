import type { Invoice, LocationStatus, Status, StatusTone } from '@/components/workspace/invoice-data'

// Shape returned by the backend GET /invoices list (via the BFF proxy).
export interface BackendInvoice {
  id: string
  status: string
  merchantName: string | null
  categoryId: string | null
  categoryName?: string | null
  transactionDate: string | null
  total: number | null
  currency: string | null
  searchTags: string[]
  searchTagLabels?: string[]
  searchCity?: string | null
  createdAt: string
  locationStatus: LocationStatus
  locationCountryCode: string | null
  locationRegionCode: string | null
}

export const STATUS_MAP: Record<string, Status> = {
  PROCESSING: ['primary', 'Reading receipt…'],
  PARSED: ['success', 'Ready'],
  // NEEDS_REVIEW stays an internal backend status for the §6.5 location gate and
  // price-index data-quality logic, but the customer sees "Ready": there is no
  // user action that flips it to PARSED, so a "Check details" badge would imply
  // an unfinishable task and erode trust. It collapses into the PARSED row.
  NEEDS_REVIEW: ['success', 'Ready'],
  FAILED_PROCESSING: ['danger', "Couldn't read"],
  SUSPECTED_DUPLICATE: ['warning', 'Possible duplicate'],
  DISCARDED: ['danger', 'Removed'],
}

// A single status explained for the customer-facing legend. Tone + label are
// derived from STATUS_MAP below so the legend can never drift from the badges
// shown in the table.
export interface StatusLegendEntry {
  tone: StatusTone
  label: string
  description: string
}

// Plain-language meaning + next action for every status, in the order a
// customer is most likely to encounter them. The drift-guard unit test asserts
// this covers every key in STATUS_MAP.
const STATUS_DESCRIPTIONS: Record<string, string> = {
  PARSED: 'We read your receipt successfully. Nothing to do.',
  PROCESSING: "We're reading it now — this usually takes a few seconds.",
  SUSPECTED_DUPLICATE: 'Looks like a receipt you already added. Open it to confirm or remove it.',
  FAILED_PROCESSING: "We couldn't read this image. Try uploading a clearer, well-lit photo.",
  DISCARDED: 'You removed this receipt. It no longer counts toward your data.',
}

// NEEDS_REVIEW is intentionally absent — it shares the "Ready" badge with PARSED
// (see STATUS_MAP) and collapses into that single legend row.
const STATUS_LEGEND_ORDER = [
  'PARSED',
  'PROCESSING',
  'SUSPECTED_DUPLICATE',
  'FAILED_PROCESSING',
  'DISCARDED',
] as const

export const STATUS_LEGEND: StatusLegendEntry[] = STATUS_LEGEND_ORDER.map((code) => {
  const [tone, label] = STATUS_MAP[code]
  return { tone, label, description: STATUS_DESCRIPTIONS[code] }
})

export function mapInvoice(b: BackendInvoice): Invoice {
  return {
    id: b.id,
    merchant: b.merchantName ?? 'Unknown merchant',
    category: b.categoryName ?? b.categoryId ?? 'Uncategorized',
    categoryId: b.categoryId ?? null,
    dateISO: b.transactionDate ?? b.createdAt.slice(0, 10),
    status: STATUS_MAP[b.status] ?? ['primary', b.status],
    tags: b.searchTagLabels ?? b.searchTags ?? [],
    searchCity: b.searchCity ?? null,
    total: b.total ?? 0,
    locationStatus: b.locationStatus ?? 'RESOLVED',
    locationCountryCode: b.locationCountryCode ?? null,
    locationRegionCode: b.locationRegionCode ?? null,
    locationConfirmable: b.status === 'PARSED' || b.status === 'NEEDS_REVIEW',
  }
}
