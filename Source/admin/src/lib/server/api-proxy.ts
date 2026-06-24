import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

const UPSTREAM_TIMEOUT_MS = 10_000

// BFF proxy: forwards an admin request to the backend API with the operator's
// Cognito ID token (the API Gateway authorizer expects the ID token). The token
// never reaches the browser. Same path locally (:3001 → apiHandler) and on AWS.
export async function proxyToBackend(
  req: NextRequest,
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
): Promise<NextResponse> {
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
  if (!bearer) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const apiBase = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL
  const init: RequestInit = {
    method,
    headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  }
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') init.body = await req.text()

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

  const isNullBody = res.status === 204 || res.status === 205 || res.status === 304
  return new NextResponse(isNullBody ? null : await res.text(), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
