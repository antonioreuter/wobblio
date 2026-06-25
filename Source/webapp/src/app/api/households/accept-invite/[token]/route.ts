import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// POST /api/households/accept-invite/:token → backend accept invite (joins household)
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return proxyToBackend(req, `/households/accept-invite/${encodeURIComponent(token)}`, 'POST')
}
