import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// POST /api/lists/:id/share → backend POST /lists/:id/share (issue a weblink share, §10b)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return proxyToBackend(req, `/lists/${encodeURIComponent(id)}/share`, 'POST')
}
