import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// POST /api/invoices/presign → backend POST /invoices/presign
export async function POST(req: NextRequest) {
  return proxyToBackend(req, '/invoices/presign', 'POST')
}
