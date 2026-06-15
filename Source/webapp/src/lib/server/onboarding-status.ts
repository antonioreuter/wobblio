import { cookies } from 'next/headers'

// 'onboarded'  — DB row exists and onboarding is complete
// 'pending'    — DB row exists, onboarding not yet complete (or a transient read error)
// 'invalid'    — backend rejected the token (401/403): the user no longer exists or
//                is locked. The session cookie is stale and must be cleared.
export type OnboardingState = 'onboarded' | 'pending' | 'invalid'

// Server-side read of the DB onboarding state (the source of truth). The client
// session token can lag — `update()` does not reliably persist to the session
// cookie under OpenNext/Lambda — so route gates verify against the DB rather than
// trust a stale token. Reuses the BFF /api/me/profile route (which attaches the
// user's Cognito ID token) by calling it same-origin with the request cookies
// forwarded; the token never leaves the server.
export async function fetchOnboardingState(): Promise<OnboardingState> {
  // Use a trusted origin — never the inbound Host header — to build the URL we
  // forward the session cookies to (avoids credential-forwarding/SSRF if Host is
  // spoofable). APP_ORIGIN is a server-only runtime var on AWS; NEXT_PUBLIC_SITE_URL
  // is the local-dev fallback. NEXT_PUBLIC_* alone is unsafe here: the OpenNext
  // build bakes .env.local's localhost over .env.production, which would point the
  // self-heal at localhost and reintroduce the post-onboarding redirect loop.
  const origin = process.env.APP_ORIGIN ?? process.env.NEXT_PUBLIC_SITE_URL
  if (!origin) return 'pending'

  const cookieHeader = (await cookies()).toString()

  try {
    const res = await fetch(`${origin}/api/me/profile`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    })
    // The user was deleted/purged or locked but the JWT cookie is still present.
    if (res.status === 401 || res.status === 403) return 'invalid'
    if (!res.ok) return 'pending'
    const profile = (await res.json()) as { onboarded?: boolean }
    return profile.onboarded ? 'onboarded' : 'pending'
  } catch {
    return 'pending'
  }
}
