import Link from 'next/link'

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
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-xl font-semibold text-text dark:text-text">This link isn’t available</h1>
        <p className="text-muted" data-testid="share-invalid">
          The share link is invalid or has expired. Ask the sender for a fresh one.
        </p>
        <Link href="/" className="mt-2 text-brand underline">
          Go to Wobblio
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8" data-testid="shared-invoice">
      <header className="mb-6">
        <p className="text-sm text-muted">Shared receipt</p>
        <h1 className="text-2xl font-semibold tracking-tight">{invoice.merchant ?? 'Receipt'}</h1>
        <div className="mt-1 flex items-baseline justify-between">
          <span className="text-sm text-muted">{formatDate(invoice.date)}</span>
          <span className="text-2xl font-semibold tabular-nums">
            {formatMoney(invoice.total, invoice.currency)}
          </span>
        </div>
      </header>

      <section className="mb-6 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
        <a href={invoice.imageUrl} target="_blank" rel="noopener noreferrer" title="Open full image">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={invoice.imageUrl} alt="Original receipt" className="w-full" />
        </a>
      </section>

      {invoice.lines.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-muted dark:border-slate-800">
              <th className="py-2 text-left font-medium">Item</th>
              <th className="py-2 text-right font-medium">Qty</th>
              <th className="py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line, i) => (
              <tr key={i} className="border-b border-slate-100 last:border-0 dark:border-slate-900">
                <td className="py-2 pr-2">
                  <div>{line.rawText}</div>
                  {line.categoryName && <div className="text-xs text-muted">{line.categoryName}</div>}
                </td>
                <td className="py-2 text-right tabular-nums">{line.quantity}</td>
                <td className="py-2 text-right tabular-nums">
                  {formatMoney(line.lineTotal, invoice.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <footer className="mt-8 text-center text-xs text-muted">
        Shared via{' '}
        <Link href="/" className="text-brand underline">
          Wobblio
        </Link>
        {' '}— read-only.
      </footer>
    </main>
  )
}
