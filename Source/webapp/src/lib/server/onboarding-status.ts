import { cookies, headers } from 'next/headers'

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
  const h = await headers()
  const host = h.get('host')
  if (!host) return 'pending'

  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  const cookieHeader = (await cookies()).toString()

  try {
    const res = await fetch(`${proto}://${host}/api/me/profile`, {
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
