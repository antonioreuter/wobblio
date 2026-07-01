import { type NextRequest } from 'next/server'
import { proxyToBackendPublic } from '@/lib/server/api-proxy'

// PATCH /api/shared-lists/:token/items/:itemId → backend checkbox toggle (public, no auth, §10b).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string; itemId: string }> },
) {
  const { token, itemId } = await params
  return proxyToBackendPublic(
    req,
    `/shared-lists/${encodeURIComponent(token)}/items/${encodeURIComponent(itemId)}`,
    'PATCH',
  )
}
