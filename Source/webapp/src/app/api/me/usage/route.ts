import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// GET /api/me/usage → backend GET /me/usage (weekly scan quota)
export async function GET(req: NextRequest) {
  return proxyToBackend(req, '/me/usage', 'GET')
}
