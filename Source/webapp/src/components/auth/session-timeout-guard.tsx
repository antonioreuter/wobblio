'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useIdleTimer } from '@/hooks/use-idle-timer/use-idle-timer'
import { IDLE_TIMEOUT_MS, IDLE_WARNING_MS } from '@/lib/auth/session-timeouts'
import { federatedSignOut } from '@/lib/federated-sign-out'
import { SessionTimeoutDialog } from './session-timeout-dialog'

// Enforces the idle-session policy inside the authenticated app:
//  - warns 2 min before a 30-min idle logout (configurable),
//  - "Stay logged in" silently refreshes the Cognito token via update(),
//  - timeout / "Log out now" / a failed token refresh all sign out (federated, so
//    the Cognito SSO cookie is cleared too) and return the user to the landing page.
export function SessionTimeoutGuard() {
  const { data: session, update } = useSession()

  const endSession = () => {
    void federatedSignOut()
  }

  const { warning, secondsLeft, stayActive } = useIdleTimer({
    idleMs: IDLE_TIMEOUT_MS,
    warningMs: IDLE_WARNING_MS,
    onTimeout: endSession,
  })

  // Silent refresh failed (refresh token expired after 30d or revoked):
  // there is nothing the user can do, so sign them out immediately.
  useEffect(() => {
    if (session?.error === 'RefreshAccessTokenError') endSession()
    // session.error is the meaningful trigger; endSession only calls signOut.
  }, [session?.error])

  if (!warning) return null

  return (
    <SessionTimeoutDialog
      secondsLeft={secondsLeft}
      onStay={() => {
        void update()
        stayActive()
      }}
      onLogout={endSession}
    />
  )
}
