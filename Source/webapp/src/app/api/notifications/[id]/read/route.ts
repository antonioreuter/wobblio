import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// POST /api/notifications/:id/read → backend POST /notifications/:id/read (mark read)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return proxyToBackend(req, `/notifications/${encodeURIComponent(id)}/read`, 'POST')
}
