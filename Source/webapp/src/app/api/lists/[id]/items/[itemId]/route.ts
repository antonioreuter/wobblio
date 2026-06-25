import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// PATCH /api/lists/:id/items/:itemId → backend PATCH (toggle checked, edit freeText/productId)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { id, itemId } = await params
  return proxyToBackend(
    req,
    `/lists/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}`,
    'PATCH',
  )
}

// DELETE /api/lists/:id/items/:itemId → backend DELETE (remove item)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { id, itemId } = await params
  return proxyToBackend(
    req,
    `/lists/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}`,
    'DELETE',
  )
}
