import { NextResponse, type NextRequest } from 'next/server'

// STUB — fail-secure: denies all requests until Cognito JWT validation is implemented.
//
// DO NOT replace this with a cookie-based role check — cookies are browser-settable
// and trivially spoofable (any user can set x-wobblio-role=ADMIN).
//
// Required replacement (see project_admin_portal_pending.md > "Middleware upgrade"):
//
//   import { verifySessionJwt } from '@/lib/verify-session-jwt'   // to be implemented
//   import { checkAdminRole } from '@/lib/check-admin-role'
//
//   const session = await verifySessionJwt(
//     request.cookies.get('session')?.value,
//     process.env.SESSION_SECRET   // Cognito app client secret / JWKS endpoint
//   )
//   if (!session || !checkAdminRole(session.role)) {
//     return NextResponse.redirect(new URL('/403', request.url))
//   }
//   return NextResponse.next()
//
// For local development before auth is wired: run `next dev` and temporarily
// disable the middleware matcher below, or mock the session cookie with a
// locally-signed JWT (never use a plain-text role cookie).

export function middleware(request: NextRequest) {
  return NextResponse.redirect(new URL('/403', request.url))
}

export const config = {
  matcher: ['/((?!403|_next/static|_next/image|favicon.ico).*)'],
}
