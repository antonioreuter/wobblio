import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// POST /api/lists/:id/complete → backend POST /lists/:id/complete (mark list completed/archived)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return proxyToBackend(req, `/lists/${encodeURIComponent(id)}/complete`, 'POST')
}
