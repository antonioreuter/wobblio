import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// GET /api/reports/spend → backend GET /reports/spend
// Hierarchical spend-breakdown report (category → merchant → item-category → items). The
// query string (period, from/to, country/region, categoryId/merchantId/itemCategoryId) is
// forwarded verbatim; the backend enforces the 90-day cap and the premium item-level gate.
export async function GET(req: NextRequest) {
  const qs = req.nextUrl.search
  return proxyToBackend(req, `/reports/spend${qs}`, 'GET')
}
