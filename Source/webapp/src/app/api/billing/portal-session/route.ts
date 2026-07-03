import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// POST /api/billing/portal-session → backend POST /billing/portal-session.
// PREMIUM-only; currently returns a mocked `mock://portal/{userId}` URL until
// Stripe is wired (§05-billing-stripe.md) — see the Settings "Manage billing" button.
export async function POST(req: NextRequest) {
  return proxyToBackend(req, '/billing/portal-session', 'POST')
}
