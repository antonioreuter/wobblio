import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// GET /api/reference/categories → backend GET /reference/categories (spend taxonomy)
export async function GET(req: NextRequest) {
  return proxyToBackend(req, '/reference/categories', 'GET')
}
