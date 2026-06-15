import { NextResponse, type NextRequest } from 'next/server'

// Federated logout: after the local NextAuth session cookie is cleared (client
// side), this redirects to the Cognito Hosted-UI /logout endpoint so the IdP SSO
// cookie is cleared too. Without this, signOut() only drops the app session and
// the next signIn() silently re-authenticates against the surviving Cognito
// session — letting a "logged out" user straight back in.
export async function GET(req: NextRequest) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin
  const dest = `${origin}/`

  const domain = process.env.COGNITO_DOMAIN
  const clientId = process.env.COGNITO_CLIENT_ID
  const isLocal = Boolean(process.env.COGNITO_ENDPOINT)

  // Local dev (cognito-local) has no Hosted-UI logout endpoint — just land on the
  // marketing page; the session cookie is already cleared.
  if (isLocal || !domain || !clientId) {
    return NextResponse.redirect(dest)
  }

  const logoutUrl =
    `https://${domain}/logout?client_id=${encodeURIComponent(clientId)}` +
    `&logout_uri=${encodeURIComponent(dest)}`
  return NextResponse.redirect(logoutUrl)
}
