import type { Invoice, Status } from '@/components/workspace/invoice-data'

// Shape returned by the backend GET /invoices list (via the BFF proxy).
export interface BackendInvoice {
  id: string
  status: string
  merchantName: string | null
  categoryId: string | null
  transactionDate: string | null
  total: number | null
  currency: string | null
  searchTags: string[]
  createdAt: string
}

const STATUS_MAP: Record<string, Status> = {
  PROCESSING: ['primary', 'Processing'],
  PARSED: ['success', 'Parsed'],
  NEEDS_REVIEW: ['warning', 'Needs Review'],
  FAILED_PROCESSING: ['danger', 'Failed'],
  SUSPECTED_DUPLICATE: ['warning', 'Possible duplicate'],
  DISCARDED: ['danger', 'Discarded'],
}

export function mapInvoice(b: BackendInvoice): Invoice {
  return {
    id: b.id,
    merchant: b.merchantName ?? 'Unknown merchant',
    category: b.categoryId ?? 'Uncategorized',
    dateISO: b.transactionDate ?? b.createdAt.slice(0, 10),
    status: STATUS_MAP[b.status] ?? ['primary', b.status],
    tags: b.searchTags ?? [],
    total: b.total ?? 0,
  }
}
