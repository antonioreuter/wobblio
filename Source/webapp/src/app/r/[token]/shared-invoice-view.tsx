'use client'

import Link from 'next/link'
import { Calendar, ShieldCheck, AlertTriangle, FileText, ExternalLink } from 'lucide-react'
import { Card, Badge, WobblioLogo, ThemeToggle, MerchantIcon } from '@/components/ds'
import { ReceiptViewer } from '@/components/workspace/receipt-viewer'

export interface SharedLine {
  rawText: string
  quantity: number
  unitPrice: number | null
  lineTotal: number
  categoryName: string | null
}

export interface SharedInvoice {
  merchant: string | null
  date: string | null
  total: number | null
  currency: string | null
  lines: SharedLine[]
  imageUrl: string
}

function formatMoney(amount: number | null, currency: string | null): string {
  if (amount === null) return '—'
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

export function SharedInvoiceView({ invoice }: { invoice: SharedInvoice | null }) {
  if (!invoice) {
    return (
      <div className="min-h-screen flex flex-col bg-bg text-primary">
        <nav className="border-b border-glass-border bg-glass-bg backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl h-16 items-center justify-between px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
              <WobblioLogo size={32} withWordmark />
            </Link>
            <ThemeToggle />
          </div>
        </nav>
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
            <Link href="/" className="btn btn--primary w-full mt-2">
              Go to Wobblio
            </Link>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg text-primary">
      {/* Premium Navbar */}
      <nav className="sticky top-0 z-50 w-full border-b border-glass-border bg-glass-bg/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl h-16 items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
            <WobblioLogo size={32} withWordmark />
          </Link>
          <ThemeToggle />
        </div>
      </nav>

      {/* Main Grid */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 md:py-12" data-testid="shared-invoice">
        <div className="mb-6 md:mb-8">
          <div className="flex items-center gap-2 text-xs font-semibold text-brand uppercase tracking-wider mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
            Shared Receipt Link
          </div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-heading bg-clip-text text-transparent">
            Verify & Inspect Receipt
          </h2>
          <p className="text-sm text-secondary mt-1 max-w-2xl">
            These receipt details were extracted automatically using AI. Check the parsed items side-by-side with the original image.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Left Column: Digital Receipt Card */}
          <div className="lg:col-span-7">
            <Card className="p-6 md:p-8 flex flex-col gap-6 relative overflow-hidden">
              {/* Receipt Visual Accent */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-brand" />

              {/* Card Header: Merchant and Metadata */}
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <MerchantIcon merchant={invoice.merchant ?? ''} size={48} />
                    <div>
                      <span className="text-xs font-semibold text-brand tracking-wider uppercase">Extracted Details</span>
                      <h1 className="text-xl sm:text-2xl font-bold tracking-tight mt-0.5 text-primary break-words">
                        {invoice.merchant ?? 'Receipt'}
                      </h1>
                    </div>
                  </div>
                  <Badge tone="success">Verified</Badge>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-glass-border pt-4 text-sm">
                  <div className="flex items-center gap-2 text-secondary">
                    <Calendar size={15} className="text-brand" />
                    <span>{formatDate(invoice.date)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-muted block uppercase tracking-wider font-semibold">Total Amount</span>
                    <span className="text-2xl font-extrabold text-primary tracking-tight font-display tabular-nums">
                      {formatMoney(invoice.total, invoice.currency)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dashed Line separator */}
              <div className="border-t border-dashed border-glass-border my-2" />

              {/* Items Section */}
              {invoice.lines.length > 0 ? (
                <div className="flex flex-col gap-4">
                  <div className="drawer-receipt">
                    <div className="receipt-head">
                      <span>Item</span>
                      <span>Qty</span>
                      <span>Amount</span>
                    </div>

                    {invoice.lines.map((line, i) => (
                      <div className="receipt-row" key={i}>
                        <span className="ri-name">
                          {line.rawText}
                          {line.categoryName && (
                            <span className="ri-cat mt-1">
                              <span className="inline-flex items-center bg-brand-glow/40 px-2 py-0.5 rounded-full font-semibold text-brand text-[10px]">
                                {line.categoryName}
                              </span>
                            </span>
                          )}
                        </span>
                        <span className="ri-qty">×{line.quantity}</span>
                        <span className="ri-amt">
                          {formatMoney(line.lineTotal, invoice.currency)}
                        </span>
                      </div>
                    ))}

                    <div className="receipt-totals">
                      <div className="receipt-grand">
                        <span>Total</span>
                        <span>{formatMoney(invoice.total, invoice.currency)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="drawer-note mt-2">
                    <ShieldCheck size={14} /> Parsed automatically · location metadata removed.
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 text-muted italic bg-glass-highlight rounded-xl border border-glass-border">
                  No line items parsed from this receipt.
                </div>
              )}
            </Card>
          </div>

          {/* Right Column: Original Receipt Image & Viewer */}
          <div className="lg:col-span-5">
            <Card className="p-4 sm:p-6 flex flex-col gap-4 min-h-[340px] sm:min-h-[440px] lg:sticky lg:top-24 lg:h-[calc(100vh-280px)] lg:min-h-[550px]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-muted uppercase tracking-wider">
                  <FileText size={14} className="text-brand" />
                  <span>Original Document</span>
                </div>
                <a
                  href={invoice.imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-brand hover:underline font-semibold"
                >
                  Open Original <ExternalLink size={12} />
                </a>
              </div>

              <div className="h-px bg-glass-border" />

              <div className="flex-1 relative rounded-xl overflow-hidden border border-glass-border bg-black/10">
                <ReceiptViewer imageUrl={invoice.imageUrl} />
              </div>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-glass-border bg-glass-bg/30 text-center text-xs text-muted mt-12">
        <div className="flex flex-col items-center gap-2">
          <div>
            Shared via{' '}
            <Link href="/" className="text-brand font-semibold hover:underline">
              Wobblio
            </Link>
            {' '}— Cloud-native personal fiscal management.
          </div>
          <div className="text-[11px] opacity-75">
            This link is read-only.
          </div>
        </div>
      </footer>
    </div>
  )
}
