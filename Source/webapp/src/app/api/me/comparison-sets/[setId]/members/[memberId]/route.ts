import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

const path = (setId: string, memberId: string) =>
  `/me/comparison-sets/${encodeURIComponent(setId)}/members/${encodeURIComponent(memberId)}`

// PATCH → toggle { sizeEquivalent }; DELETE → remove the member.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ setId: string; memberId: string }> }) {
  const { setId, memberId } = await params
  return proxyToBackend(req, path(setId, memberId), 'PATCH')
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ setId: string; memberId: string }> }) {
  const { setId, memberId } = await params
  return proxyToBackend(req, path(setId, memberId), 'DELETE')
}
