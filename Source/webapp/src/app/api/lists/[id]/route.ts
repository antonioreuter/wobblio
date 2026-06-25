import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// GET /api/lists/:id → backend GET /lists/:id (list detail with ordered items)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return proxyToBackend(req, `/lists/${encodeURIComponent(id)}`, 'GET')
}
