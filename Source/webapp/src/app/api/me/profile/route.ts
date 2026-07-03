import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// GET /api/me/profile → backend GET /me/profile (the DB source of truth).
// Used by the onboarding self-heal and the Settings page's profile form.
export async function GET(req: NextRequest) {
  return proxyToBackend(req, '/me/profile', 'GET')
}

// PUT /api/me/profile → backend PUT /me/profile. Same completeOnboarding write
// path onboarding uses — re-runnable any time to edit name/country/region/
// language/currency (Settings carries the existing birthdate/consent through).
export async function PUT(req: NextRequest) {
  return proxyToBackend(req, '/me/profile', 'PUT')
}
