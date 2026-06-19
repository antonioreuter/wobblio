import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/auth'

const PUBLIC_PATHS = new Set(['/', '/login', '/register', '/forgot-password'])

function isPublic(pathname: string): boolean {
  return (
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith('/r/') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/waitlist') ||
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
  // Runtime server-only var on AWS; falls back to the build-time public var for
  // local dev. Avoids inlining .env.local's localhost origin into the deployed
  // CSP. Client calls go same-origin via /api/* BFF routes, covered by 'self'.
  const apiOrigin = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? ''

  // Receipt capture PUTs directly to a presigned S3 URL and the review/inspection
  // drawer renders the photo from a presigned S3 GET — both hit the uploads bucket
  // origin, not our API. Allow it in connect-src (upload) and img-src (display).
  const uploadsOrigin =
    process.env.UPLOADS_BUCKET_ORIGIN ?? process.env.NEXT_PUBLIC_UPLOADS_BUCKET_ORIGIN ?? ''

  const directives = [
    "default-src 'self'",
    // nonce + strict-dynamic: modern browsers trust nonce and ignore 'unsafe-inline';
    // 'unsafe-inline' is the fallback for legacy browsers only.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline'`,
    "style-src 'self' 'unsafe-inline'",        // Tailwind requires inline styles
    `img-src 'self' data: blob: ${uploadsOrigin}`,
    "font-src 'self'",
    `connect-src 'self' ${apiOrigin} ${uploadsOrigin}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ]

  // Force HTTPS only in production. Local `next dev` serves http, and this
  // directive would upgrade same-origin redirects (e.g. /login) to https →
  // ERR_SSL_PROTOCOL_ERROR. Deployed stages run NODE_ENV=production behind TLS.
  if (process.env.NODE_ENV === 'production') {
    directives.push('upgrade-insecure-requests')
  }

  return directives
    .map((directive) => directive.trim().replace(/\s+/g, ' '))
    .join('; ')
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
  // pass it to any <Script nonce={nonce}> they render. The CSP must also be on
  // the REQUEST headers: that's how Next.js reads the nonce and applies it to
  // its own framework inline scripts (hydration bootstrap). Without it, those
  // scripts are blocked because a nonce in script-src makes the browser ignore
  // 'unsafe-inline'.
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })

  response.headers.set('Content-Security-Policy',   csp)
  response.headers.set('X-Frame-Options',           'DENY')
  response.headers.set('X-Content-Type-Options',    'nosniff')
  response.headers.set('Referrer-Policy',           'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy',        'camera=(), microphone=(), geolocation=(), payment=()')

  return response
})

export const config = {
  // Exclude /api/auth/* — these are NextAuth's own routes plus the federated
  // logout route, which manage their own cookies. Running the auth() wrapper here
  // rolls (re-issues) the session cookie on the response, which would overwrite
  // the logout route's cookie-clearing and leave the user signed in.
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon\\.ico).*)'],
}
