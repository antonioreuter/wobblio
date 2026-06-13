'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, ReceiptText, ThumbsUp, ThumbsDown } from 'lucide-react'
import { DataTable, type Column } from '@/components/ui/data-table'
import { ConfidenceBadge } from '@/components/ui/confidence-badge'
import { CategoryChip } from '@/components/ui/category-chip'
import { Money } from '@/components/ui/money'
import { RightDrawer } from '@/components/ui/right-drawer'
import { ParseReviewScreen } from '@/components/screens/parse-review-screen'
import { EmptyState } from '@/components/ui/empty-state'
import { MerchantIcon } from '@/components/ui/merchant-icon'

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

const getLineItemsForInvoice = (id: string) => {
  if (id === '1') {
    return [
      { name: 'Organic Whole Milk 1L', price: 1.25 },
      { name: 'Organic Avocados (2)', price: 2.98 },
      { name: 'Fairtrade Bananas', price: 1.99 },
      { name: 'Sourdough Bread', price: 2.80 },
      { name: 'Other Grocery Items (10)', price: 38.83 },
    ]
  }
  if (id === '2') {
    return [
      { name: 'Compost soil 40L', price: 12.5 },
      { name: 'Garden Shears Pro', price: 34.99 },
      { name: 'Premium Hardwood Decking', price: 76.51 },
    ]
  }
  return [
    { name: 'Pasta Carbonara', price: 14.5 },
    { name: 'Pizza Margherita', price: 12.0 },
    { name: 'Red Wine glass', price: 6.5 },
    { name: 'Espresso', price: 2.5 },
    { name: 'Service Tip', price: 3.0 },
  ]
}

const COLUMNS: Column<InvoiceRow>[] = [
  { key: 'date', header: 'Date' },
  {
    key: 'merchant',
    header: 'Merchant',
    render: (row) => (
      <div className="flex items-center gap-2">
        <MerchantIcon merchantName={row.merchant} className="h-6 w-6 text-[10px]" />
        <span>{row.merchant}</span>
      </div>
    ),
  },
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
  const [isDesktop, setIsDesktop] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [itemFeedback, setItemFeedback] = useState<Record<string, 'up' | 'down' | undefined>>({})

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)')
    setIsDesktop(media.matches)
    const listener = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [])

  // Auto select the first invoice on desktop if none selected
  const selectedInvoiceToShow = selectedInvoice || (isDesktop ? MOCK_INVOICES[0] : null)

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[24px] font-bold text-[#0f172a] dark:text-[#f1f5f9]">Invoices</h1>

      {/* NEEDS_REVIEW banner */}
      {needsReview.length > 0 && (
        <div className="flex items-center gap-3 rounded-[12px] border border-[#d97706]/20 bg-[#fef3c7]/60 dark:bg-[#d97706]/10 px-4 py-3 text-[#d97706]">
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

      <div className="invoices-split-grid">
        {/* Left Column: Table */}
        <div className="glass-card overflow-hidden">
          <DataTable
            columns={COLUMNS}
            rows={MOCK_INVOICES}
            onRowClick={(row) => {
              setSelectedInvoice(row)
              if (!isDesktop) {
                // Let the drawer handle it on mobile
              }
            }}
            emptyState={
              <EmptyState
                icon={ReceiptText}
                heading="No invoices yet"
                body="Scan your first receipt to start tracking your spending."
              />
            }
          />
        </div>

        {/* Right Column: Desktop Detail Preview */}
        <div className="hidden lg:block">
          {selectedInvoiceToShow ? (
            <div className="glass-card p-6 flex flex-col gap-5 sticky top-6">
              <div className="flex justify-between items-center pb-4 border-b border-[var(--color-glass-border)]">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Merchant</span>
                  <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-1.5 mt-0.5">
                    <MerchantIcon merchantName={selectedInvoiceToShow.merchant} className="h-5 w-5" />
                    {selectedInvoiceToShow.merchant}
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total</span>
                  <div className="mt-0.5 font-mono text-base font-bold text-[var(--text-primary)]">
                    <Money amount={selectedInvoiceToShow.total} size="secondary" />
                  </div>
                </div>
              </div>

              {/* Mock photo display */}
              <div className="h-36 rounded-lg bg-slate-950 flex items-center justify-center relative overflow-hidden border border-[var(--color-glass-border)]">
                <span className="absolute top-2 left-2 badge badge--primary text-[9px] uppercase tracking-widest opacity-80">
                  AI OCR SCAN
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  {selectedInvoiceToShow.merchant.toLowerCase().replace(/\s+/g, '_')}_receipt.png
                </span>
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg border border-slate-200 dark:border-[var(--color-glass-border)]">
                <div>
                  <span className="text-[10px] text-slate-400 block">Date</span>
                  <span className="font-semibold text-[var(--text-primary)]">{selectedInvoiceToShow.date}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Status</span>
                  <span className="inline-flex mt-0.5">
                    <ConfidenceBadge confidence={selectedInvoiceToShow.status} />
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div className="flex flex-col gap-2">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Extracted Items ({selectedInvoiceToShow.items})
                </h4>
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {getLineItemsForInvoice(selectedInvoiceToShow.id).map((item, idx) => {
                    const feedbackKey = `${selectedInvoiceToShow.id}-${item.name}`
                    return (
                      <div
                        key={idx}
                        className="flex justify-between items-center text-xs p-2 rounded bg-slate-50 dark:bg-slate-900/20 border border-slate-200 dark:border-[var(--color-glass-border)]"
                      >
                        <div className="flex flex-col">
                          <span className="text-[var(--text-primary)] font-medium">{item.name}</span>
                          <div className="flex gap-2 mt-1">
                            <button
                              className={`p-0.5 transition-colors ${
                                itemFeedback[feedbackKey] === 'up'
                                  ? 'text-emerald-500'
                                  : 'text-slate-400 hover:text-emerald-500'
                              }`}
                              onClick={() =>
                                setItemFeedback((prev) => ({
                                  ...prev,
                                  [feedbackKey]: prev[feedbackKey] === 'up' ? undefined : 'up',
                                }))
                              }
                              title="Correct Extraction"
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              className={`p-0.5 transition-colors ${
                                itemFeedback[feedbackKey] === 'down'
                                  ? 'text-rose-500'
                                  : 'text-slate-400 hover:text-rose-500'
                              }`}
                              onClick={() =>
                                setItemFeedback((prev) => ({
                                  ...prev,
                                  [feedbackKey]: prev[feedbackKey] === 'down' ? undefined : 'down',
                                }))
                              }
                              title="Incorrect Extraction"
                            >
                              <ThumbsDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <span className="text-[var(--text-primary)] font-bold font-mono">
                          €{item.price.toFixed(2)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={() => setIsDrawerOpen(true)}
                  className="btn btn--outline flex-1 text-center justify-center py-2"
                  style={{ fontSize: '12.5px' }}
                >
                  Edit details
                </button>
                <button
                  onClick={() => alert('Receipt successfully approved!')}
                  className="btn btn--primary flex-1 text-center justify-center py-2"
                  style={{ fontSize: '12.5px' }}
                >
                  Approve scan
                </button>
              </div>
            </div>
          ) : (
            <div className="glass-card p-8 text-center flex flex-col items-center justify-center h-64 gap-3">
              <span className="text-3xl">🧾</span>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">No Invoice Selected</h3>
              <p className="text-xs text-[var(--text-secondary)] max-w-[220px]">
                Select any row in the ledger table to view full OCR extraction data, line items, and scan confidence.
              </p>
            </div>
          )}
        </div>
      </div>

      <RightDrawer
        open={isDrawerOpen || (!isDesktop && !!selectedInvoice)}
        onClose={() => {
          setSelectedInvoice(null)
          setIsDrawerOpen(false)
        }}
        title={selectedInvoice?.merchant}
      >
        {selectedInvoice && (
          <ParseReviewScreen
            fields={[
              { label: 'Merchant', value: selectedInvoice.merchant, confidence: 'confirmed' },
              { label: 'Date', value: selectedInvoice.date, confidence: 'confirmed' },
              {
                label: 'Total',
                value: String(selectedInvoice.total),
                confidence: selectedInvoice.status,
                isAmount: true,
              },
              { label: 'Category', value: selectedInvoice.category, confidence: selectedInvoice.status },
            ]}
            tags={tags}
            tagVocabulary={['organic', 'weekly-shop', 'work-expense', 'household']}
            onAddTag={(t) => setTags((prev) => [...prev, t])}
            onRemoveTag={(t) => setTags((prev) => prev.filter((x) => x !== t))}
            onConfirm={() => {
              setSelectedInvoice(null)
              setIsDrawerOpen(false)
            }}
          />
        )}
      </RightDrawer>
    </div>
  )
}

