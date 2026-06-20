import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// PATCH /api/budgets/:id → backend PATCH /budgets/:id (update amount/period)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return proxyToBackend(req, `/budgets/${encodeURIComponent(id)}`, 'PATCH')
}

// DELETE /api/budgets/:id → backend DELETE /budgets/:id
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return proxyToBackend(req, `/budgets/${encodeURIComponent(id)}`, 'DELETE')
}
