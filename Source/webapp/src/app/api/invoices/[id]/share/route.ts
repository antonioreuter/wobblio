import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// POST /api/invoices/:id/share → backend POST /invoices/:id/share
// (issues a public read-only /r/<token> link for the receipt).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return proxyToBackend(req, `/invoices/${encodeURIComponent(id)}/share`, 'POST')
}
