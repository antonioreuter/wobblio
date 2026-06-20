import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// GET /api/me/stats/top-merchant → backend GET /me/stats/top-merchant
// (highest summed-spend merchant for the current month)
export async function GET(req: NextRequest) {
  return proxyToBackend(req, '/me/stats/top-merchant', 'GET')
}
