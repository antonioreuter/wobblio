import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/auth'

const PUBLIC_PATHS = new Set(['/', '/login', '/register', '/forgot-password'])

function isPublic(pathname: string): boolean {
  return (
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  )
}

function generateNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString('base64')
}

function buildCsp(nonce: string): string {
  const apiOrigin = process.env.NEXT_PUBLIC_API_BASE_URL ?? ''

  return [
    "default-src 'self'",
    // nonce + strict-dynamic: modern browsers trust nonce and ignore 'unsafe-inline';
    // 'unsafe-inline' is the fallback for legacy browsers only.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline'`,
    "style-src 'self' 'unsafe-inline'",        // Tailwind requires inline styles
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${apiOrigin}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join('; ')
}

export default auth((req: NextRequest & { auth: unknown }) => {
  const { pathname } = req.nextUrl

  // Redirect unauthenticated users away from protected routes
  if (!isPublic(pathname) && !(req as { auth: unknown }).auth) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const nonce = generateNonce()
  const csp   = buildCsp(nonce)

  // Forward nonce to server components via request header so layouts can
  // pass it to any <Script nonce={nonce}> they render
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-nonce', nonce)

  const response = NextResponse.next({ request: { headers: requestHeaders } })

  response.headers.set('Content-Security-Policy',   csp)
  response.headers.set('X-Frame-Options',           'DENY')
  response.headers.set('X-Content-Type-Options',    'nosniff')
  response.headers.set('Referrer-Policy',           'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy',        'camera=(), microphone=(), geolocation=(), payment=()')

  return response
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
