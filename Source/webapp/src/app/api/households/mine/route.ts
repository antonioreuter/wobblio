import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// GET /api/households/mine → backend GET /households/mine (own household + roster, or null)
export async function GET(req: NextRequest) {
  return proxyToBackend(req, '/households/mine', 'GET')
}
