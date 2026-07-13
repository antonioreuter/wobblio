import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// POST /api/me/comparison-sets/:setId/members → add a product { productId, sizeEquivalent? }.
export async function POST(req: NextRequest, { params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params
  return proxyToBackend(req, `/me/comparison-sets/${encodeURIComponent(setId)}/members`, 'POST')
}
