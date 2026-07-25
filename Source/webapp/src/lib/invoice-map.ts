import type { Invoice, LocationStatus, Status, StatusTone } from '@/components/workspace/invoice-data'

// Shape returned by the backend GET /invoices list (via the BFF proxy).
export interface BackendInvoice {
  id: string
  status: string
  // Coarse pipeline stage while status is PROCESSING (specs/fixes/07.01).
  // Optional until the backend ships it — absence falls back to the generic label.
  processingStage?: string | null
  merchantName: string | null
  categoryId: string | null
  categoryName?: string | null
  transactionDate: string | null
  total: number | null
  currency: string | null
  // Receipt total converted to the user's home currency (frozen transaction-date rate).
  // Null when already home-currency or no rate was available. Optional until every backend
  // deploy ships it; the dashboard falls back to `total` when absent.
  totalHomeCurrency?: number | null
  searchTags: string[]
  searchTagLabels?: string[]
  searchCity?: string | null
  createdAt: string
  locationStatus: LocationStatus
  locationCountryCode: string | null
  locationRegionCode: string | null
}

// Stage-accurate labels while PROCESSING (specs/fixes/07.02). Honest stages,
// never fake percentages; the legend keeps the single generic PROCESSING row.
export const PROCESSING_STAGE_LABELS: Record<string, string> = {
  RECEIVED: 'Received — starting…',
  READING: 'Reading your receipt…',
  MATCHING: 'Matching products & prices…',
  FINALIZING: 'Finishing up…',
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
  // Fix 11 Layer C: a legible-enough photo we still couldn't parse reliably. Actionable
  // (retake) and not charged — amber, not red, because the user has a clear next step.
  RETAKE_SUGGESTED: ['warning', 'Retake needed'],
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
  PROCESSING: "We're reading it now — this usually takes about 20 seconds.",
  SUSPECTED_DUPLICATE: 'Looks like a receipt you already added. Open it to confirm or remove it.',
  FAILED_PROCESSING: "We couldn't read this image. Try uploading a clearer, well-lit photo.",
  RETAKE_SUGGESTED: "We couldn't get a reliable read. Retake it laid flat and fully in frame — for a long receipt, capture it in sections. No scan was deducted.",
  DISCARDED: 'You removed this receipt. It no longer counts toward your data.',
}

// NEEDS_REVIEW is intentionally absent — it shares the "Ready" badge with PARSED
// (see STATUS_MAP) and collapses into that single legend row.
const STATUS_LEGEND_ORDER = [
  'PARSED',
  'PROCESSING',
  'SUSPECTED_DUPLICATE',
  'RETAKE_SUGGESTED',
  'FAILED_PROCESSING',
  'DISCARDED',
] as const

export const STATUS_LEGEND: StatusLegendEntry[] = STATUS_LEGEND_ORDER.map((code) => {
  const [tone, label] = STATUS_MAP[code]
  return { tone, label, description: STATUS_DESCRIPTIONS[code] }
})

// The badge for a row: stage-accurate while PROCESSING (when the backend sends
// a known stage), else the static STATUS_MAP entry.
function statusBadge(b: BackendInvoice): Status {
  if (b.status === 'PROCESSING' && b.processingStage) {
    const stageLabel = PROCESSING_STAGE_LABELS[b.processingStage]
    if (stageLabel) return ['primary', stageLabel]
  }
  return STATUS_MAP[b.status] ?? ['primary', b.status]
}

export function mapInvoice(b: BackendInvoice): Invoice {
  return {
    id: b.id,
    merchant: b.merchantName ?? 'Unknown merchant',
    category: b.categoryName ?? b.categoryId ?? 'Uncategorized',
    categoryId: b.categoryId ?? null,
    dateISO: b.transactionDate ?? b.createdAt.slice(0, 10),
    status: statusBadge(b),
    rawStatus: b.status,
    isProcessing: b.status === 'PROCESSING',
    tags: b.searchTagLabels ?? b.searchTags ?? [],
    searchCity: b.searchCity ?? null,
    total: b.total ?? 0,
    currency: b.currency ?? null,
    totalHomeCurrency: b.totalHomeCurrency ?? null,
    locationStatus: b.locationStatus ?? 'RESOLVED',
    locationCountryCode: b.locationCountryCode ?? null,
    locationRegionCode: b.locationRegionCode ?? null,
    locationConfirmable: b.status === 'PARSED' || b.status === 'NEEDS_REVIEW',
  }
}
