import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// POST /api/households → backend POST /households (create household, PREMIUM only)
export async function POST(req: NextRequest) {
  return proxyToBackend(req, '/households', 'POST')
}
