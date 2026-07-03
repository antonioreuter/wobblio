import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// PUT /api/me/price-contribution-optout → backend PUT /me/price-contribution-optout
// (§14a) — body { optout: boolean }, 204 on success.
export async function PUT(req: NextRequest) {
  return proxyToBackend(req, '/me/price-contribution-optout', 'PUT')
}
