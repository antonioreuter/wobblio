import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// GET /api/households/:id → backend GET /households/:id (detail + roster + pool)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return proxyToBackend(req, `/households/${encodeURIComponent(id)}`, 'GET')
}

// DELETE /api/households/:id → backend DELETE /households/:id (disband, owner only)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return proxyToBackend(req, `/households/${encodeURIComponent(id)}`, 'DELETE')
}
