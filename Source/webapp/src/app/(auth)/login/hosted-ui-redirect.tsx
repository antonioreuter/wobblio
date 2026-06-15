'use client'

import { useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { LoaderCircle, ScanLine } from 'lucide-react'
import { Button } from '@/components/ds/Button'

// Hosted-UI (dev/prod) sign-in. Auto-initiates the Cognito OAuth flow on mount
// — this runs client-side, so NextAuth sets its PKCE/state cookies via the
// /api/auth route handler (a server component render cannot set cookies). Shows a
// neutral "redirecting" interstitial (not the credentials "Welcome back" copy) so
// the brief moment before the redirect isn't confusing. The button is the manual
// fallback if the auto-redirect is blocked.
export function HostedUiRedirect() {
  useEffect(() => {
    void signIn('cognito', { callbackUrl: '/dashboard' })
  }, [])

  return (
    <div
      className="auth-form"
      data-testid="hosted-ui-redirect"
      style={{ alignItems: 'center', textAlign: 'center', gap: '16px' }}
    >
      <LoaderCircle size={30} className="spin" style={{ color: 'var(--brand)' }} aria-hidden />
      <p className="auth-sub" role="status">Taking you to secure sign-in…</p>
      <Button
        type="button"
        variant="outline"
        style={{ width: '100%' }}
        iconLeft={<ScanLine size={16} />}
        onClick={() => signIn('cognito', { callbackUrl: '/dashboard' })}
        data-testid="hosted-ui-continue"
      >
        Continue to sign in
      </Button>
    </div>
  )
}
