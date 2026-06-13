'use client'

import { StatCard } from '@/components/ui/stat-card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { ConfidenceBadge } from '@/components/ui/confidence-badge'
import { CategoryChip } from '@/components/ui/category-chip'
import { Money } from '@/components/ui/money'
import { EmptyState } from '@/components/ui/empty-state'
import { ReceiptText } from 'lucide-react'

interface InvoiceRow {
  id: string
  date: string
  merchant: string
  category: string
  categoryColor: string
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
    total: 47.85,
    status: 'confirmed',
  },
  {
    id: '2',
    date: '2026-06-10',
    merchant: 'Praxis',
    category: 'Home & Garden',
    categoryColor: '#7c3aed',
    total: 124.0,
    status: 'auto',
  },
  {
    id: '3',
    date: '2026-06-09',
    merchant: 'Vapiano',
    category: 'Dining',
    categoryColor: '#ea580c',
    total: 38.5,
    status: 'low',
  },
]

const COLUMNS: Column<InvoiceRow>[] = [
  { key: 'date', header: 'Date' },
  { key: 'merchant', header: 'Merchant' },
  {
    key: 'category',
    header: 'Category',
    render: (row) => <CategoryChip label={row.category} color={row.categoryColor} />,
  },
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

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[24px] font-bold text-[#0f172a] dark:text-[#f1f5f9]">Dashboard</h1>

      {/* Stat card row */}
      <div className="flex flex-wrap gap-4">
        <StatCard label="Month-to-date spend" amount={1284.5} delta={8.3} deltaLabel="vs May" />
        <StatCard label="Δ vs last month" amount={98.5} delta={8.3} deltaLabel="more" />
        <StatCard label="Budget health" value="68%" delta={-5.2} deltaLabel="vs last month" />
        <StatCard label="Scans remaining" value="3" />
      </div>

      {/* Charts placeholder */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="col-span-2 flex h-48 items-center justify-center rounded-[12px] border border-dashed border-[#e2e8f0] text-sm text-[#64748b] dark:border-[#334155] dark:text-[#94a3b8]">
          Spend-over-time area chart
        </div>
        <div className="flex h-48 items-center justify-center rounded-[12px] border border-dashed border-[#e2e8f0] text-sm text-[#64748b] dark:border-[#334155] dark:text-[#94a3b8]">
          Category donut
        </div>
      </div>

      {/* Recent invoices */}
      <div className="rounded-[12px] border border-[#e2e8f0] bg-white dark:border-[#334155] dark:bg-[#111827]">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-3 dark:border-[#334155]">
          <p className="text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
            Recent Invoices
          </p>
          <a href="/invoices" className="text-xs text-[#0d9488] hover:underline">
            See all
          </a>
        </div>
        <DataTable
          columns={COLUMNS}
          rows={MOCK_INVOICES}
          emptyState={
            <EmptyState
              icon={ReceiptText}
              heading="No invoices yet"
              body="Scan your first receipt to see your spending here."
              ctaLabel="Scan receipt"
              onCta={() => { }}
            />
          }
        />
      </div>
    </div>
  )
}
