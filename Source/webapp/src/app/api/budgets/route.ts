import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// GET /api/budgets → backend GET /budgets (tenant budgets with live accumulated + alert status)
export async function GET(req: NextRequest) {
  return proxyToBackend(req, '/budgets', 'GET')
}

// POST /api/budgets → backend POST /budgets (create; PREMIUM-only, ≤10 enforced upstream)
export async function POST(req: NextRequest) {
  return proxyToBackend(req, '/budgets', 'POST')
}
