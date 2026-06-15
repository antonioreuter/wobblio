import { signOut } from 'next-auth/react'

// Full sign-out: clears the local NextAuth session, then routes through
// /api/auth/cognito-logout which clears the Cognito Hosted-UI SSO cookie (in
// dev/prod) before landing on the marketing page. A plain signOut() leaves the
// IdP session alive, so the next sign-in skips the credential prompt.
export async function federatedSignOut(): Promise<void> {
  await signOut({ redirect: false })
  window.location.assign('/api/auth/cognito-logout')
}
