import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// POST /api/invoices/:id/feedback → backend POST /invoices/:id/feedback (verdict UP/DOWN)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return proxyToBackend(req, `/invoices/${encodeURIComponent(id)}/feedback`, 'POST')
}
