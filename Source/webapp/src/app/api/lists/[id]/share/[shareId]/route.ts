import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// DELETE /api/lists/:id/share/:shareId → backend revoke a list share link (§10b)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; shareId: string }> },
) {
  const { id, shareId } = await params
  return proxyToBackend(
    req,
    `/lists/${encodeURIComponent(id)}/share/${encodeURIComponent(shareId)}`,
    'DELETE',
  )
}
