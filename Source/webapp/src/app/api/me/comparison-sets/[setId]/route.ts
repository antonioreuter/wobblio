import { type NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

const path = (setId: string) => `/me/comparison-sets/${encodeURIComponent(setId)}`

export async function GET(req: NextRequest, { params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params
  return proxyToBackend(req, path(setId), 'GET')
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params
  return proxyToBackend(req, path(setId), 'PATCH')
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params
  return proxyToBackend(req, path(setId), 'DELETE')
}
