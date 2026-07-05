import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// PUT /api/invoices/:id/splits/:splitId/lines/:lineId/allocations
// → backend PUT .../lines/:lineId/allocations — replaces the line's whole allocation
// set (several participants may each take a quantity of the line's units).
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; splitId: string; lineId: string }> },
) {
  const { id, splitId, lineId } = await params
  return proxyToBackend(
    req,
    `/invoices/${encodeURIComponent(id)}/splits/${encodeURIComponent(splitId)}/lines/${encodeURIComponent(lineId)}/allocations`,
    'PUT',
  )
}
