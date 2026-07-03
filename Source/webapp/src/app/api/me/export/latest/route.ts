import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// GET /api/me/export/latest → backend GET /me/export/latest (§14b) — the
// Settings page's export status poll: { request: null | DataRequest }.
export async function GET(req: NextRequest) {
  return proxyToBackend(req, '/me/export/latest', 'GET')
}
