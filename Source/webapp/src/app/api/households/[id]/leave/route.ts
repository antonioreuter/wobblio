import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// POST /api/households/:id/leave → backend POST /households/:id/leave (non-owner member)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return proxyToBackend(req, `/households/${encodeURIComponent(id)}/leave`, 'POST')
}
