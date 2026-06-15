'use client'

import { useEffect } from 'react'
import { federatedSignOut } from '@/lib/federated-sign-out'

// Terminal state for a stale session whose user no longer exists (backend 401/403).
// A server redirect can't fix it — the JWT cookie would survive and bounce back —
// so we sign out client-side (which clears the cookie, plus the Cognito SSO cookie)
// and land on the marketing page.
export function ForceSignOut() {
  useEffect(() => {
    void federatedSignOut()
  }, [])

  return (
    <div className="auth-screen">
      <div className="auth-card glass">
        <p className="auth-sub" role="status" data-testid="force-sign-out">
          Signing you out…
        </p>
      </div>
    </div>
  )
}
