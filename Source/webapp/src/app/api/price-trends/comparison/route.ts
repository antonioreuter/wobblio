import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// GET /api/price-trends/comparison → backend GET /price-trends/comparison
// (§6.5.1 premium comparison chart; query string — products, country, region — is
// forwarded verbatim to the backend, which gates the feature to Premium roles).
export async function GET(req: NextRequest) {
  const qs = req.nextUrl.search
  return proxyToBackend(req, `/price-trends/comparison${qs}`, 'GET')
}
