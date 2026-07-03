import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// POST /api/me/export → backend POST /me/export (§14b) — 202 { requestId },
// 429 when the 1-request-per-24h limit is hit.
export async function POST(req: NextRequest) {
  return proxyToBackend(req, '/me/export', 'POST')
}
