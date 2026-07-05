'use client'

import Link from 'next/link'
import { Calendar, AlertTriangle, Users, ShieldCheck } from 'lucide-react'
import { Card, Badge, WobblioLogo, ThemeToggle } from '@/components/ds'

export interface SharedSplitItem {
  lineId: string
  label: string
  qty: number
  fraction: number
  amount: number
}

export interface SharedSplitParticipant {
  name: string
  subtotal: number
  fees: number
  total: number
  items: SharedSplitItem[]
}

export interface SharedSplit {
  merchant: string | null
  date: string | null
  currency: string | null
  participants: SharedSplitParticipant[]
  grandTotal: number
}

function formatMoney(amount: number, currency: string | null): string {
  if (!currency) return amount.toFixed(2)
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

// A shared single item reads as its fraction glyph; everything else as a unit count.
function shareLabel(item: SharedSplitItem): string {
  if (Math.abs(item.fraction - 0.5) < 1e-3) return '½'
  if (Math.abs(item.fraction - 1 / 3) < 1e-3) return '⅓'
  return `×${Number(item.qty)}`
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-bg text-primary">
      <nav className="sticky top-0 z-50 w-full border-b border-glass-border bg-glass-bg/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl h-16 items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
            <WobblioLogo size={32} withWordmark />
          </Link>
          <ThemeToggle />
        </div>
      </nav>
      {children}
      <footer className="py-8 border-t border-glass-border bg-glass-bg/30 text-center text-xs text-muted mt-12">
        <div className="flex flex-col items-center gap-2">
          <div>
            Shared via{' '}
            <Link href="/" className="text-brand font-semibold hover:underline">Wobblio</Link>
            {' '}— Cloud-native personal fiscal management.
          </div>
          <div className="text-[11px] opacity-75">This link is read-only.</div>
        </div>
      </footer>
    </div>
  )
}

export function SharedSplitView({ split }: { split: SharedSplit | null }) {
  if (!split) {
    return (
      <Shell>
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <Card className="w-full max-w-md text-center p-8 flex flex-col items-center gap-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-glow text-danger">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight mb-2">This link isn’t available</h1>
              <p className="text-sm text-secondary leading-relaxed" data-testid="share-invalid">
                The share link is invalid or has expired. Ask the sender for a fresh one.
              </p>
            </div>
            <Link href="/" className="btn btn--primary w-full mt-2">Go to Wobblio</Link>
          </Card>
        </main>
      </Shell>
    )
  }

  return (
    <Shell>
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-6 md:py-12" data-testid="shared-split">
        <div className="mb-6 md:mb-8">
          <div className="flex items-center gap-2 text-xs font-semibold text-brand uppercase tracking-wider mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
            Shared Bill Split
          </div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-heading bg-clip-text text-transparent">
            Who owes what
          </h2>
        </div>

        <Card className="p-6 md:p-8 flex flex-col gap-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-brand" />
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-glow text-brand">
                <Users size={22} />
              </div>
              <div>
                <span className="text-xs font-semibold text-brand tracking-wider uppercase">Split summary</span>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight mt-0.5 text-primary break-words">
                  {split.merchant ?? 'Receipt'}
                </h1>
              </div>
            </div>
            <Badge tone="success">{split.participants.length} {split.participants.length === 1 ? 'person' : 'people'}</Badge>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-glass-border pt-4 text-sm">
            <div className="flex items-center gap-2 text-secondary">
              <Calendar size={15} className="text-brand" />
              <span>{formatDate(split.date)}</span>
            </div>
            <div className="text-right">
              <span className="text-xs text-muted block uppercase tracking-wider font-semibold">Total</span>
              <span className="text-2xl font-extrabold text-primary tracking-tight font-display tabular-nums">
                {formatMoney(split.grandTotal, split.currency)}
              </span>
            </div>
          </div>

          <div className="border-t border-dashed border-glass-border" />

          <div className="split-summary" data-testid="shared-split-summary">
            {split.participants.map((p) => (
              <div className="store-block" key={p.name}>
                <div className="store-head">
                  <span className="store-name">{p.name}</span>
                  <span className="store-subtotal tabular">{formatMoney(p.total, split.currency)}</span>
                </div>
                <div className="store-lines">
                  {p.items.map((item) => (
                    <div className="split-item-row" key={item.lineId}>
                      <span className="split-item-name">{item.label} {shareLabel(item)}</span>
                      <span className="split-item-amt">{formatMoney(item.amount, split.currency)}</span>
                    </div>
                  ))}
                  <div className="split-item-row">
                    <span className="split-item-name">Fees &amp; charges</span>
                    <span className="split-item-amt">{formatMoney(p.fees, split.currency)}</span>
                  </div>
                </div>
              </div>
            ))}
            <div className="receipt-grand">
              <span>Total</span>
              <span>{formatMoney(split.grandTotal, split.currency)}</span>
            </div>
          </div>

          <div className="drawer-note">
            <ShieldCheck size={14} /> Each person’s share of taxes, tips and fees is included.
          </div>
        </Card>
      </main>
    </Shell>
  )
}
