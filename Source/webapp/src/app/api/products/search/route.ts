import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// GET /api/products/search → backend GET /products/search
// (§10 autocomplete: ACTIVE global products ∪ the caller's own PROVISIONAL products).
export async function GET(req: NextRequest) {
  const qs = req.nextUrl.search
  return proxyToBackend(req, `/products/search${qs}`, 'GET')
}
