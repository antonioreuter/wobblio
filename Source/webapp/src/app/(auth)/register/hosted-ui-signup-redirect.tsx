'use client'

import { useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { LoaderCircle, UserPlus } from 'lucide-react'
import { Button } from '@/components/ds/Button'

// Hosted-UI (dev/prod) sign-up. Auto-initiates the Cognito OAuth flow on mount —
// this runs client-side, so NextAuth sets its PKCE/state cookies via the
// /api/auth route handler (a server component render cannot set cookies). The
// `cognito-signup` provider deep-links to the Hosted-UI `/signup` tab (see
// auth.ts); Cognito owns the email-verification-code step and its
// PostConfirmation Lambda provisions the app_user row, so on return the (app)
// layout gate routes the not-yet-onboarded user to /onboarding. The button is the
// manual fallback if the auto-redirect is blocked.
export function HostedUiSignupRedirect() {
  useEffect(() => {
    void signIn('cognito-signup', { callbackUrl: '/dashboard' })
  }, [])

  return (
    <div
      className="auth-form"
      data-testid="hosted-ui-signup-redirect"
      style={{ alignItems: 'center', textAlign: 'center', gap: '16px' }}
    >
      <LoaderCircle size={30} className="spin" style={{ color: 'var(--brand)' }} aria-hidden />
      <p className="auth-sub" role="status">Taking you to secure sign-up…</p>
      <Button
        type="button"
        variant="outline"
        style={{ width: '100%' }}
        iconLeft={<UserPlus size={16} />}
        onClick={() => signIn('cognito-signup', { callbackUrl: '/dashboard' })}
        data-testid="hosted-ui-signup-continue"
      >
        Continue to create account
      </Button>
    </div>
  )
}
