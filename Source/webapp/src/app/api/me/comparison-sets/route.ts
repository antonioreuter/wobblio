import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// GET /api/me/comparison-sets → backend list of the caller's comparison sets (09/04).
export async function GET(req: NextRequest) {
  return proxyToBackend(req, '/me/comparison-sets', 'GET')
}

// POST /api/me/comparison-sets → create a set { name? }.
export async function POST(req: NextRequest) {
  return proxyToBackend(req, '/me/comparison-sets', 'POST')
}
