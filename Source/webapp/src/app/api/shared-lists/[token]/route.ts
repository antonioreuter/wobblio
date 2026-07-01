import { type NextRequest } from 'next/server'
import { proxyToBackendPublic } from '@/lib/server/api-proxy'

// GET /api/shared-lists/:token → backend GET /shared-lists/:token (public, no auth, §10b).
// The unguessable token is the credential; no Cognito bearer is attached.
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return proxyToBackendPublic(req, `/shared-lists/${encodeURIComponent(token)}`, 'GET')
}
