import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// GET /api/price-trends/suggestions → backend GET /price-trends/suggestions (fix 10).
// Counterpart products at other merchants in the region for the just-selected product; the query
// string (productId, country, region) is forwarded verbatim.
export async function GET(req: NextRequest) {
  const qs = req.nextUrl.search
  return proxyToBackend(req, `/price-trends/suggestions${qs}`, 'GET')
}
