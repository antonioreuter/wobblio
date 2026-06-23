// Extracts the verified admin identity from a NextAuth session. The session cookie
// is an AUTH_SECRET-signed JWT decoded upstream by NextAuth's `auth()` wrapper —
// here we validate the *claims* and pull { role, sub, email }, returning null on any
// problem so the middleware fails secure. role is DB-canonical (carried from
// /me/profile at sign-in), NOT a spoofable Cognito attribute.
export interface AdminSession {
  role: string
  sub: string
  email: string
}

interface SessionLike {
  user?: { id?: string | null; email?: string | null; role?: string | null }
  expires?: string
  error?: string
}

export function verifySessionJwt(session: SessionLike | null | undefined): AdminSession | null {
  if (!session?.user) return null
  if (session.error) return null // refresh/decrypt failure → treat as unauthenticated

  const { id, email, role } = session.user
  if (!id || !email || !role) return null // missing claim

  if (session.expires && new Date(session.expires).getTime() <= Date.now()) return null

  return { role, sub: id, email }
}
