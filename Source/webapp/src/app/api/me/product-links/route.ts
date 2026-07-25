import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// GET /api/me/product-links?products=a,b,c → accepted links among the selected products (fix 10),
// for the trend report's size-confirm affordance.
export async function GET(req: NextRequest) {
  const qs = req.nextUrl.search
  return proxyToBackend(req, `/me/product-links${qs}`, 'GET')
}

// POST /api/me/product-links → accept/dismiss a cross-merchant pair { selfProductId, otherProductId, status } (fix 10).
export async function POST(req: NextRequest) {
  return proxyToBackend(req, '/me/product-links', 'POST')
}

// PATCH /api/me/product-links → confirm same-size on an accepted pair { selfProductId, otherProductId, sizeEquivalent }.
export async function PATCH(req: NextRequest) {
  return proxyToBackend(req, '/me/product-links', 'PATCH')
}
