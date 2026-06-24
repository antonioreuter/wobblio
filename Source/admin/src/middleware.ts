import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { verifySessionJwt } from '@/lib/verify-session-jwt'
import { checkAdminRole } from '@/lib/check-admin-role'

// Edge gate: only an authenticated ADMIN reaches any console page. Role comes from
// the verified NextAuth session (DB-canonical), never a plain cookie field —
// spoofable role cookies are a critical auth bypass (finding 2026-06-11). This is
// defence-in-depth; every /admin/* backend endpoint re-checks the role server-side.
export default auth((req) => {
  const session = verifySessionJwt(req.auth as Parameters<typeof verifySessionJwt>[0])
  // No (valid) session → send the operator to sign in, not the dead-end /403.
  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  // Authenticated but not an ADMIN → access denied.
  if (!checkAdminRole(session.role)) {
    return NextResponse.redirect(new URL('/403', req.url))
  }
  return NextResponse.next()
})

export const config = {
  // /login + /api/auth must stay reachable for an unauthenticated operator to sign
  // in; /403 and static assets are excluded too.
  matcher: ['/((?!403|login|api/auth|_next/static|_next/image|favicon.ico).*)'],
}
