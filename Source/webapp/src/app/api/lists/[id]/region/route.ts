import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// PATCH /api/lists/:id/region → backend PATCH /lists/:id/region (Premium per-list region override, §10b)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return proxyToBackend(req, `/lists/${encodeURIComponent(id)}/region`, 'PATCH')
}
