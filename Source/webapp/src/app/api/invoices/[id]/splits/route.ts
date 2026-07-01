import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// POST /api/invoices/:id/splits → backend POST /invoices/:id/splits (creates a bill split)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return proxyToBackend(req, `/invoices/${encodeURIComponent(id)}/splits`, 'POST')
}
