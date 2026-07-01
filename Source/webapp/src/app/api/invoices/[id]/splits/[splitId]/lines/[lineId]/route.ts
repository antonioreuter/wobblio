import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// PATCH /api/invoices/:id/splits/:splitId/lines/:lineId → backend PATCH .../lines/:lineId
// (assign a line to a participant with a fraction)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; splitId: string; lineId: string }> },
) {
  const { id, splitId, lineId } = await params
  return proxyToBackend(
    req,
    `/invoices/${encodeURIComponent(id)}/splits/${encodeURIComponent(splitId)}/lines/${encodeURIComponent(lineId)}`,
    'PATCH',
  )
}
