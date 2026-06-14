'use client'

import { SessionProvider } from 'next-auth/react'
import type { Session } from 'next-auth'

// Wraps the authenticated app in NextAuth's client SessionProvider so
// useSession()/update() are available. refetchInterval lets a failed silent
// refresh surface session.error without any user action, so the timeout guard
// can sign the user out and return them to the landing page.
export function AuthSessionProvider({
  session,
  children,
}: {
  session: Session | null
  children: React.ReactNode
}) {
  return (
    <SessionProvider
      session={session}
      refetchInterval={5 * 60}
      refetchOnWindowFocus
    >
      {children}
    </SessionProvider>
  )
}
