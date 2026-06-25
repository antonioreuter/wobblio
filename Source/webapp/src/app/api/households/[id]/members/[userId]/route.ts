import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// DELETE /api/households/:id/members/:userId → backend remove member (owner only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const { id, userId } = await params
  return proxyToBackend(
    req,
    `/households/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`,
    'DELETE',
  )
}
