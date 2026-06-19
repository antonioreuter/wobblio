import { SharedInvoiceView, type SharedInvoice } from './shared-invoice-view'

// Public, unauthenticated page (allowlisted in middleware). Resolves the share
// token server-side against the backend's public /shared-invoices/{token} route;
// the presigned photo URL it returns is short-lived (≤300s), so never cache.
export const dynamic = 'force-dynamic'

async function fetchSharedInvoice(token: string): Promise<SharedInvoice | null> {
  const base = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL
  if (!base) return null
  const res = await fetch(`${base}/shared-invoices/${encodeURIComponent(token)}`, { cache: 'no-store' })
  if (!res.ok) return null
  return (await res.json()) as SharedInvoice
}

export default async function SharedInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const invoice = await fetchSharedInvoice(token)
  return <SharedInvoiceView invoice={invoice} />
}
