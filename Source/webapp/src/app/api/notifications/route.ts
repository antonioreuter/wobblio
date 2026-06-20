import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// GET /api/notifications → backend GET /notifications (active, non-expired, RLS-scoped)
export async function GET(req: NextRequest) {
  return proxyToBackend(req, '/notifications', 'GET')
}
