import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// DELETE /api/invoices/:id/splits/:splitId/lines/:lineId/assignment
// → backend DELETE .../lines/:lineId/assignment (unassigns the line)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; splitId: string; lineId: string }> },
) {
  const { id, splitId, lineId } = await params
  return proxyToBackend(
    req,
    `/invoices/${encodeURIComponent(id)}/splits/${encodeURIComponent(splitId)}/lines/${encodeURIComponent(lineId)}/assignment`,
    'DELETE',
  )
}
