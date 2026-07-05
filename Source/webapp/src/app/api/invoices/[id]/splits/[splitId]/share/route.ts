import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// POST /api/invoices/:id/splits/:splitId/share → backend POST .../splits/:splitId/share
// (issues a public read-only /s/<token> link for the split's per-person breakdown).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; splitId: string }> },
) {
  const { id, splitId } = await params
  return proxyToBackend(
    req,
    `/invoices/${encodeURIComponent(id)}/splits/${encodeURIComponent(splitId)}/share`,
    'POST',
  )
}
