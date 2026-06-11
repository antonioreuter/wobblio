'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { DataTable, type Column } from '@/components/ui/data-table'
import { ConfidenceBadge } from '@/components/ui/confidence-badge'
import { CategoryChip } from '@/components/ui/category-chip'
import { Money } from '@/components/ui/money'
import { RightDrawer } from '@/components/ui/right-drawer'
import { ParseReviewScreen } from '@/components/screens/parse-review-screen'
import { EmptyState } from '@/components/ui/empty-state'
import { ReceiptText } from 'lucide-react'

interface InvoiceRow {
  id: string
  date: string
  merchant: string
  category: string
  categoryColor: string
  items: number
  total: number
  status: 'confirmed' | 'auto' | 'low'
}

const MOCK_INVOICES: InvoiceRow[] = [
  {
    id: '1',
    date: '2026-06-11',
    merchant: 'Albert Heijn',
    category: 'Groceries',
    categoryColor: '#0d9488',
    items: 14,
    total: 47.85,
    status: 'confirmed',
  },
  {
    id: '2',
    date: '2026-06-10',
    merchant: 'Praxis',
    category: 'Home & Garden',
    categoryColor: '#7c3aed',
    items: 3,
    total: 124.0,
    status: 'low',
  },
  {
    id: '3',
    date: '2026-06-09',
    merchant: 'Vapiano',
    category: 'Dining',
    categoryColor: '#ea580c',
    items: 5,
    total: 38.5,
    status: 'auto',
  },
]

const needsReview = MOCK_INVOICES.filter((r) => r.status === 'low')

const COLUMNS: Column<InvoiceRow>[] = [
  { key: 'date', header: 'Date' },
  { key: 'merchant', header: 'Merchant' },
  {
    key: 'category',
    header: 'Category',
    render: (row) => <CategoryChip label={row.category} color={row.categoryColor} />,
  },
  { key: 'items', header: 'Items', numeric: true },
  {
    key: 'total',
    header: 'Total',
    numeric: true,
    render: (row) => <Money amount={row.total} size="secondary" />,
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <ConfidenceBadge confidence={row.status} />,
  },
]

export default function InvoicesPage() {
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRow | null>(null)
  const [tags, setTags] = useState<string[]>(['weekly-shop'])

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[24px] font-bold text-[#0f172a] dark:text-[#f1f5f9]">Invoices</h1>

      {/* NEEDS_REVIEW banner */}
      {needsReview.length > 0 && (
        <div className="flex items-center gap-3 rounded-[12px] border border-[#d97706]/30 bg-[#fef3c7] px-4 py-3">
          <AlertTriangle size={16} strokeWidth={1.5} className="text-[#d97706]" aria-hidden />
          <p className="text-sm font-medium text-[#d97706]">
            {needsReview.length} invoice{needsReview.length > 1 ? 's' : ''} need{needsReview.length === 1 ? 's' : ''} review
          </p>
          <button
            className="ml-auto text-xs font-medium text-[#d97706] hover:underline"
            onClick={() => setSelectedInvoice(needsReview[0])}
          >
            Review now
          </button>
        </div>
      )}

      <div className="rounded-[12px] border border-[#e2e8f0] bg-white dark:border-[#334155] dark:bg-[#111827]">
        <DataTable
          columns={COLUMNS}
          rows={MOCK_INVOICES}
          onRowClick={setSelectedInvoice}
          emptyState={
            <EmptyState
              icon={ReceiptText}
              heading="No invoices yet"
              body="Scan your first receipt to start tracking your spending."
            />
          }
        />
      </div>

      <RightDrawer
        open={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        title={selectedInvoice?.merchant}
      >
        {selectedInvoice && (
          <ParseReviewScreen
            fields={[
              { label: 'Merchant', value: selectedInvoice.merchant, confidence: 'confirmed' },
              { label: 'Date', value: selectedInvoice.date, confidence: 'confirmed' },
              { label: 'Total', value: String(selectedInvoice.total), confidence: selectedInvoice.status, isAmount: true },
              { label: 'Category', value: selectedInvoice.category, confidence: selectedInvoice.status },
            ]}
            tags={tags}
            tagVocabulary={['organic', 'weekly-shop', 'work-expense', 'household']}
            onAddTag={(t) => setTags((prev) => [...prev, t])}
            onRemoveTag={(t) => setTags((prev) => prev.filter((x) => x !== t))}
            onConfirm={() => setSelectedInvoice(null)}
          />
        )}
      </RightDrawer>
    </div>
  )
}
