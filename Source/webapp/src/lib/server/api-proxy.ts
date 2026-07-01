import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Upstream calls are bounded so a hung backend returns a clean 504 rather than
// hanging the BFF request (and the caller's connection) indefinitely.
const UPSTREAM_TIMEOUT_MS = 10_000

// BFF proxy: forwards a request to the backend API with the user's Cognito token.
// Same path locally (:3001) and on AWS (API Gateway → apiHandler) — the token
// never reaches the browser. Mirrors the /api/me/profile + /api/onboarding routes.
export async function proxyToBackend(
  req: NextRequest,
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
): Promise<NextResponse> {
  // A stale/corrupt session cookie (e.g. AUTH_SECRET rotation) makes getToken
  // throw on decrypt — treat that as unauthenticated, not a server fault.
  let token
  try {
    token = await getToken({
      req,
      secret: process.env.AUTH_SECRET,
      secureCookie: process.env.NODE_ENV === 'production',
    })
  } catch (err) {
    console.error('[api-proxy] token decode failed', { path, method, error: errMessage(err) })
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const bearer = (token?.idToken ?? token?.accessToken) as string | undefined
  if (!bearer) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const apiBase = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL
  const init: RequestInit = {
    method,
    headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  }
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') init.body = await req.text()

  // The upstream being unreachable/slow (restart, ECONNREFUSED, timeout) must not
  // leak as an opaque 500 with no log — map it to a clear 504/502, like the
  // backend's own catch-and-surface in api-handler.
  let res: Response
  try {
    res = await fetch(`${apiBase}${path}`, init)
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'TimeoutError'
    console.error('[api-proxy] upstream request failed', { path, method, timedOut, error: errMessage(err) })
    return NextResponse.json(
      { message: timedOut ? 'Upstream backend timed out' : 'Upstream backend unavailable' },
      { status: timedOut ? 504 : 502 },
    )
  }

  // 204/205/304 are null-body statuses — the Response constructor throws if given
  // any body (even an empty string), so forward them with no body.
  const isNullBody = res.status === 204 || res.status === 205 || res.status === 304
  return new NextResponse(isNullBody ? null : await res.text(), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Public BFF proxy for token-gated, unauthenticated backend routes (e.g. shared
// shopping lists, §10b) — no Cognito bearer token attached; the caller's own
// share token in `path` is the credential. Mirrors proxyToBackend minus auth.
export async function proxyToBackendPublic(
  req: NextRequest,
  path: string,
  method: 'GET' | 'PATCH',
): Promise<NextResponse> {
  const apiBase = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  }
  if (method === 'PATCH') init.body = await req.text()

  let res: Response
  try {
    res = await fetch(`${apiBase}${path}`, init)
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'TimeoutError'
    console.error('[api-proxy] public upstream request failed', { path, method, timedOut, error: errMessage(err) })
    return NextResponse.json(
      { message: timedOut ? 'Upstream backend timed out' : 'Upstream backend unavailable' },
      { status: timedOut ? 504 : 502 },
    )
  }

  const isNullBody = res.status === 204 || res.status === 205 || res.status === 304
  return new NextResponse(isNullBody ? null : await res.text(), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
