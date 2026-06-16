import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// GET /api/invoices → backend GET /invoices (tenant-scoped list)
export async function GET(req: NextRequest) {
  return proxyToBackend(req, '/invoices', 'GET')
}
