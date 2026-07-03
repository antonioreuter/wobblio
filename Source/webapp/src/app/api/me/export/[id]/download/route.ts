import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// GET /api/me/export/:id/download → backend GET /me/export/:id/download (§14b).
// Mints a fresh 300s presigned URL on every call — never cache the response.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return proxyToBackend(req, `/me/export/${encodeURIComponent(id)}/download`, 'GET')
}
