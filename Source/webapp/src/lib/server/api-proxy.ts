import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// BFF proxy: forwards a request to the backend API with the user's Cognito token.
// Same path locally (:3001) and on AWS (API Gateway → apiHandler) — the token
// never reaches the browser. Mirrors the /api/me/profile + /api/onboarding routes.
export async function proxyToBackend(
  req: NextRequest,
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
): Promise<NextResponse> {
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie: process.env.NODE_ENV === 'production',
  })

  const bearer = (token?.idToken ?? token?.accessToken) as string | undefined
  if (!bearer) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const apiBase = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL
  const init: RequestInit = {
    method,
    headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
  }
  if (method === 'POST' || method === 'PUT') init.body = await req.text()

  const res = await fetch(`${apiBase}${path}`, init)
  // 204/205/304 are null-body statuses — the Response constructor throws if given
  // any body (even an empty string), so forward them with no body.
  const isNullBody = res.status === 204 || res.status === 205 || res.status === 304
  return new NextResponse(isNullBody ? null : await res.text(), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  })
}
