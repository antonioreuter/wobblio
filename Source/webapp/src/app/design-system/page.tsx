'use client'

import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Money, DeltaChip } from '@/components/ui/money'
import { StatCard } from '@/components/ui/stat-card'
import { ConfidenceBadge } from '@/components/ui/confidence-badge'
import { CategoryChip } from '@/components/ui/category-chip'
import { BudgetProgressBar } from '@/components/ui/budget-progress-bar'
import { EmptyState } from '@/components/ui/empty-state'
import { DataTable, type Column } from '@/components/ui/data-table'
import { PriceHistorySparkline } from '@/components/ui/price-history-sparkline'
import { StoreComparisonBarGroup } from '@/components/ui/store-comparison-bar-group'
import { ReceiptText } from 'lucide-react'

interface TableRow {
  id: string
  merchant: string
  amount: number
  date: string
}

const TABLE_ROWS: TableRow[] = [
  { id: '1', merchant: 'Albert Heijn', amount: 47.85, date: '2026-06-11' },
  { id: '2', merchant: 'Praxis', amount: 124.0, date: '2026-06-10' },
]

const TABLE_COLS: Column<TableRow>[] = [
  { key: 'date', header: 'Date' },
  { key: 'merchant', header: 'Merchant' },
  { key: 'amount', header: 'Total', numeric: true, render: (r) => <Money amount={r.amount} size="secondary" /> },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="border-b border-[#e2e8f0] pb-2 text-[20px] font-semibold text-[#0f172a] dark:border-[#334155] dark:text-[#f1f5f9]">
        {title}
      </h2>
      {children}
    </section>
  )
}

export default function DesignSystemPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-12 p-8">
      <div>
        <h1 className="text-[30px] font-bold text-[#0f172a] dark:text-[#f1f5f9]">
          Wobblio Design System
        </h1>
        <p className="mt-1 text-sm text-[#64748b] dark:text-[#94a3b8]">
          Component library preview — calm, precise, financial-grade trust with consumer warmth.
        </p>
      </div>

      <Section title="Colors">
        <div className="flex flex-wrap gap-3">
          {[
            { name: 'brand', color: '#0d9488' },
            { name: 'success', color: '#16a34a' },
            { name: 'warning', color: '#d97706' },
            { name: 'error', color: '#dc2626' },
            { name: 'text', color: '#0f172a' },
            { name: 'muted', color: '#64748b' },
            { name: 'surface', color: '#f8fafc', border: true },
            { name: 'background', color: '#ffffff', border: true },
          ].map(({ name, color, border }) => (
            <div key={name} className="flex flex-col items-center gap-1">
              <div
                className="h-10 w-10 rounded-[8px]"
                style={{ backgroundColor: color, border: border ? '1px solid #e2e8f0' : undefined }}
              />
              <p className="text-xs text-[#64748b]">{name}</p>
              <p className="font-mono text-xs text-[#64748b]">{color}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="primary" size="sm">Small</Button>
          <Button variant="primary" size="lg">Large</Button>
          <Button variant="primary" disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="Badges">
        <div className="flex flex-wrap gap-3">
          <Badge variant="brand">Brand</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="error">Error</Badge>
          <Badge variant="muted">Muted</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
      </Section>

      <Section title="Money & Delta">
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <p className="mb-1 text-xs text-[#64748b]">Display (30px)</p>
            <Money amount={1284.5} size="display" />
          </div>
          <div>
            <p className="mb-1 text-xs text-[#64748b]">Body</p>
            <Money amount={47.85} size="body" />
          </div>
          <div>
            <p className="mb-1 text-xs text-[#64748b]">Secondary</p>
            <Money amount={12.0} size="secondary" />
          </div>
          <div>
            <p className="mb-1 text-xs text-[#64748b]">Delta (positive = bad for spend)</p>
            <DeltaChip value={8.3} />
          </div>
          <div>
            <p className="mb-1 text-xs text-[#64748b]">Delta (negative = good)</p>
            <DeltaChip value={-5.2} />
          </div>
        </div>
      </Section>

      <Section title="Stat Cards">
        <div className="flex flex-wrap gap-4">
          <StatCard label="Month-to-date spend" amount={1284.5} delta={8.3} deltaLabel="vs May" />
          <StatCard label="Budget health" value="68%" delta={-5.2} deltaLabel="improved" />
          <StatCard label="Scans remaining" value="3" />
        </div>
      </Section>

      <Section title="Confidence Badges">
        <div className="flex gap-3">
          <ConfidenceBadge confidence="confirmed" />
          <ConfidenceBadge confidence="auto" />
          <ConfidenceBadge confidence="low" />
        </div>
      </Section>

      <Section title="Category Chips">
        <div className="flex flex-wrap gap-2">
          <CategoryChip label="Groceries" color="#0d9488" />
          <CategoryChip label="Dining" color="#ea580c" />
          <CategoryChip label="Home & Garden" color="#7c3aed" />
          <CategoryChip label="Transport" color="#2563eb" />
          <CategoryChip label="Health" color="#16a34a" />
        </div>
      </Section>

      <Section title="Budget Progress Bars">
        <div className="flex max-w-sm flex-col gap-4">
          <BudgetProgressBar label="Groceries" spent={340} limit={500} />
          <BudgetProgressBar label="Dining" spent={261} limit={300} />
          <BudgetProgressBar label="Transport" spent={78} limit={150} />
          <BudgetProgressBar label="Over budget" spent={320} limit={300} />
        </div>
      </Section>

      <Section title="Input">
        <div className="max-w-sm space-y-4">
          <Input label="Merchant name" placeholder="e.g. Albert Heijn" />
          <Input label="Amount" placeholder="0.00" helper="Enter the total amount" />
          <Input label="Email" placeholder="you@example.com" error="Invalid email address" />
        </div>
      </Section>

      <Section title="Data Table">
        <div className="rounded-[12px] border border-[#e2e8f0] dark:border-[#334155]">
          <DataTable columns={TABLE_COLS} rows={TABLE_ROWS} onRowClick={() => {}} />
        </div>
      </Section>

      <Section title="Empty State">
        <Card>
          <EmptyState
            icon={ReceiptText}
            heading="No invoices yet"
            body="Scan your first receipt to start tracking your spending."
            ctaLabel="Scan receipt"
            onCta={() => {}}
          />
        </Card>
      </Section>

      <Section title="Price History Sparkline">
        <div className="flex gap-8 items-center">
          <div>
            <p className="mb-2 text-xs text-[#64748b]">Fresh</p>
            <PriceHistorySparkline
              points={[
                { value: 2.49 }, { value: 2.59 }, { value: 2.45 },
                { value: 2.62 }, { value: 2.55 }, { value: 2.50 },
              ]}
            />
          </div>
          <div>
            <p className="mb-2 text-xs text-[#64748b]">Stale</p>
            <PriceHistorySparkline
              stale
              points={[
                { value: 3.99 }, { value: 3.89 }, { value: 4.10 },
                { value: 4.05 }, { value: 3.95 }, { value: 4.20 },
              ]}
            />
          </div>
        </div>
      </Section>

      <Section title="Store Comparison">
        <StoreComparisonBarGroup
          product="Whole milk 1L"
          bars={[
            { store: 'Albert Heijn', price: 1.09 },
            { store: 'Jumbo', price: 0.99 },
            { store: 'Lidl', price: 0.85 },
          ]}
        />
      </Section>

      <Section title="Card">
        <div className="flex gap-4">
          <Card padding="sm">
            <CardHeader>
              <CardTitle>Card (sm padding)</CardTitle>
            </CardHeader>
            <p className="text-sm text-[#64748b]">Content goes here</p>
          </Card>
          <Card padding="lg">
            <CardHeader>
              <CardTitle>Card (lg padding)</CardTitle>
            </CardHeader>
            <p className="text-sm text-[#64748b]">More spacious content</p>
          </Card>
        </div>
      </Section>
    </div>
  )
}
