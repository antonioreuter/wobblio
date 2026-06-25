import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// DELETE /api/households/:id/invites/:inviteId → backend revoke invite (owner only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; inviteId: string }> },
) {
  const { id, inviteId } = await params
  return proxyToBackend(
    req,
    `/households/${encodeURIComponent(id)}/invites/${encodeURIComponent(inviteId)}`,
    'DELETE',
  )
}
