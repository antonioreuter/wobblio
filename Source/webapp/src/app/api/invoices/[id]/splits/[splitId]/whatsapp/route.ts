import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// GET /api/invoices/:id/splits/:splitId/whatsapp → backend GET .../whatsapp
// (formatted copy-to-clipboard export text)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; splitId: string }> },
) {
  const { id, splitId } = await params
  return proxyToBackend(
    req,
    `/invoices/${encodeURIComponent(id)}/splits/${encodeURIComponent(splitId)}/whatsapp`,
    'GET',
  )
}
