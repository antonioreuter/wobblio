import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// GET /api/lists → backend GET /lists (caller's active lists with item counts)
export async function GET(req: NextRequest) {
  return proxyToBackend(req, '/lists', 'GET')
}

// POST /api/lists → backend POST /lists (create; active-list cap enforced upstream)
export async function POST(req: NextRequest) {
  return proxyToBackend(req, '/lists', 'POST')
}
