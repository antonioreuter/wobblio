import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// POST /api/households/:id/invite → backend POST /households/:id/invite (owner only)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return proxyToBackend(req, `/households/${encodeURIComponent(id)}/invite`, 'POST')
}
