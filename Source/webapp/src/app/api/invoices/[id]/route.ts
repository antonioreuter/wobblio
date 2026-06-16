import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// GET /api/invoices/:id → backend GET /invoices/:id (detail + presigned image URL)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return proxyToBackend(req, `/invoices/${encodeURIComponent(id)}`, 'GET')
}
