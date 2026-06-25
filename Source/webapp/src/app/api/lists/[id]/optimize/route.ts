import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// POST /api/lists/:id/optimize → backend POST /lists/:id/optimize (PREMIUM split-route optimizer)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return proxyToBackend(req, `/lists/${encodeURIComponent(id)}/optimize`, 'POST')
}
