import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// POST /api/lists/:id/items → backend POST /lists/:id/items (add item; freeText + optional productId)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return proxyToBackend(req, `/lists/${encodeURIComponent(id)}/items`, 'POST')
}
