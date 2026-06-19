import type { Invoice, LocationStatus, Status } from '@/components/workspace/invoice-data'

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
  createdAt: string
  locationStatus: LocationStatus
  locationCountryCode: string | null
  locationRegionCode: string | null
}

const STATUS_MAP: Record<string, Status> = {
  PROCESSING: ['primary', 'Reading receipt…'],
  PARSED: ['success', 'Ready'],
  NEEDS_REVIEW: ['warning', 'Check details'],
  FAILED_PROCESSING: ['danger', "Couldn't read"],
  SUSPECTED_DUPLICATE: ['warning', 'Possible duplicate'],
  DISCARDED: ['danger', 'Removed'],
}

export function mapInvoice(b: BackendInvoice): Invoice {
  return {
    id: b.id,
    merchant: b.merchantName ?? 'Unknown merchant',
    category: b.categoryName ?? b.categoryId ?? 'Uncategorized',
    dateISO: b.transactionDate ?? b.createdAt.slice(0, 10),
    status: STATUS_MAP[b.status] ?? ['primary', b.status],
    tags: b.searchTagLabels ?? b.searchTags ?? [],
    total: b.total ?? 0,
    locationStatus: b.locationStatus ?? 'RESOLVED',
    locationCountryCode: b.locationCountryCode ?? null,
    locationRegionCode: b.locationRegionCode ?? null,
    locationConfirmable: b.status === 'PARSED' || b.status === 'NEEDS_REVIEW',
  }
}
