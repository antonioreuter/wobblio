import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// BFF proxy: reads the user's profile (the DB source of truth) from the backend
// /me/profile route with the user's Cognito ID token. Same path locally (:3001)
// and on AWS (API Gateway → apiHandler) — the token never reaches the browser.
// Used by the onboarding self-heal to verify DB onboarding status.
export async function GET(req: NextRequest) {
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
  const res = await fetch(`${apiBase}/me/profile`, {
    headers: { Authorization: `Bearer ${bearer}` },
  })

  return new NextResponse(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  })
}
