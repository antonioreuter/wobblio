import { NextResponse, type NextRequest } from 'next/server'

// Federated logout: after the local NextAuth session cookie is cleared (client
// side), this redirects to the Cognito Hosted-UI /logout endpoint so the IdP SSO
// cookie is cleared too. Without this, signOut() only drops the app session and
// the next signIn() silently re-authenticates against the surviving Cognito
// session — letting a "logged out" user straight back in.
//
// Belt-and-braces cookie clearing: under OpenNext/Lambda the client-side
// signOut() Set-Cookie does not reliably expire the (chunked) session cookie, so
// the user stays logged in after "Sign out". This route — the final hop of
// federatedSignOut — expires the NextAuth session cookies server-side on the
// redirect response, guaranteeing a forced re-login.

// Auth.js session-token cookie base names (secure prefix in prod, plain locally).
// The value is chunked when large (Cognito tokens), so clear the base name and a
// generous range of chunk suffixes.
const SESSION_COOKIE_BASES = ['__Secure-authjs.session-token', 'authjs.session-token']

function expireSessionCookies(res: NextResponse): void {
  for (const base of SESSION_COOKIE_BASES) {
    const secure = base.startsWith('__Secure-')
    for (const name of [base, ...Array.from({ length: 6 }, (_, i) => `${base}.${i}`)]) {
      res.cookies.set(name, '', {
        path: '/',
        maxAge: 0,
        expires: new Date(0),
        httpOnly: true,
        sameSite: 'lax',
        secure,
      })
    }
  }
}

export async function GET(req: NextRequest) {
  // Runtime server var on AWS (set by WobblioWebStack); falls back to the
  // build-time public var for local dev, then the request origin. NEXT_PUBLIC_*
  // is build-time inlined and the deploy bakes .env.local's localhost, so it must
  // not be the primary source for the post-logout landing URL.
  const origin = process.env.APP_ORIGIN ?? process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin
  const dest = `${origin}/`

  const domain = process.env.COGNITO_DOMAIN
  const clientId = process.env.COGNITO_CLIENT_ID
  const isLocal = Boolean(process.env.COGNITO_ENDPOINT)

  // Local dev (cognito-local) has no Hosted-UI logout endpoint — just land on the
  // marketing page; the session cookie is already cleared.
  const res =
    isLocal || !domain || !clientId
      ? NextResponse.redirect(dest)
      : NextResponse.redirect(
          `https://${domain}/logout?client_id=${encodeURIComponent(clientId)}` +
            `&logout_uri=${encodeURIComponent(dest)}`,
        )

  expireSessionCookies(res)
  return res
}
