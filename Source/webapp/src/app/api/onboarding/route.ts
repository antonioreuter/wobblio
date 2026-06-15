import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// BFF proxy: forwards the onboarding profile to the backend /me/profile route
// with the user's Cognito access token. Same path locally (:3001) and on AWS
// (API Gateway → apiHandler) — the access token never reaches the browser.
export async function POST(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie: process.env.NODE_ENV === 'production',
  })

  // The API Gateway Cognito authorizer (no scopes) validates ID tokens; the
  // local harness accepts either. Forward the ID token, falling back to access.
  const bearer = (token?.idToken ?? token?.accessToken) as string | undefined
  if (!bearer) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  // Prefer the runtime server-only var (set on AWS); fall back to the
  // build-time public var for local dev (`next dev` reads .env.local).
  const apiBase = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL
  const res = await fetch(`${apiBase}/me/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` },
    body: await req.text(),
  })

  return new NextResponse(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  })
}
