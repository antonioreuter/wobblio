import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// BFF proxy: forwards the onboarding region lookup to the backend
// GET /reference/regions?country=XX with the user's Cognito token. Same path
// locally (:3001) and on AWS (API Gateway → apiHandler).
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

  const country = req.nextUrl.searchParams.get('country') ?? ''
  const apiBase = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL
  const res = await fetch(`${apiBase}/reference/regions?country=${encodeURIComponent(country)}`, {
    headers: { Authorization: `Bearer ${bearer}` },
  })

  return new NextResponse(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  })
}
