import type { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/server/api-proxy'

// Catch-all BFF for the admin console: /api/admin/<x> → backend /admin/<x>, carrying
// the operator's Cognito token and the original query string. The backend re-checks
// the ADMIN role on every call (server gate).
async function forward(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
) {
  const { path } = await ctx.params
  const search = req.nextUrl.search
  return proxyToBackend(req, `/admin/${path.join('/')}${search}`, method)
}

export const GET = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) =>
  forward(req, ctx, 'GET')
export const POST = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) =>
  forward(req, ctx, 'POST')
export const PUT = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) =>
  forward(req, ctx, 'PUT')
export const DELETE = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) =>
  forward(req, ctx, 'DELETE')
