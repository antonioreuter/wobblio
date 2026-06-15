import { redirect } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { auth } from '@/auth'
import { fetchOnboardingState } from '@/lib/server/onboarding-status'
import { ForceSignOut } from '@/components/auth/force-sign-out'
import { WobblioLogo } from '@/components/ds/WobblioLogo'
import { AuthSessionProvider } from '@/components/providers/auth-session-provider'
import { OnboardingForm } from './onboarding-form'

export const metadata = { title: 'Complete your profile — Wobblio' }

// Lives outside the (app) route group so the app-layout onboarding gate can
// redirect here without looping. Credentials/Hosted-UI sign-up only captures
// email + password; this step gathers the rest of the profile.
export default async function OnboardingPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  // Trust a true token fast-path; otherwise confirm against the DB (the token
  // can lag — see (app)/layout) so an already-onboarded user is never shown the
  // form again.
  if (session.user.onboarded) redirect('/dashboard')
  const state = await fetchOnboardingState()
  if (state === 'invalid') return <ForceSignOut />
  if (state === 'onboarded') redirect('/dashboard')

  return (
    <AuthSessionProvider session={session}>
      <div className="auth-screen">
        <div className="auth-card glass">
          <div className="auth-brand">
            <WobblioLogo size={30} withWordmark />
          </div>
          <h1 className="auth-title">Almost there</h1>
          <p className="auth-sub">A few details so Wobblio speaks your currency and language.</p>
          <OnboardingForm />
        </div>
        <p className="auth-legal">
          <ShieldCheck size={14} /> Protected by row-level security · GDPR-compliant · EU-hosted
        </p>
      </div>
    </AuthSessionProvider>
  )
}
