import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import { WobblioLogo } from '@/components/ds/WobblioLogo'
import { RegisterForm } from './register-form'
import { HostedUiSignupRedirect } from './hosted-ui-signup-redirect'

export const metadata = { title: 'Create account — Wobblio' }

export default function RegisterPage() {
  // Local dev runs cognito-local with a credentials provider → render the
  // email/password form. Dev/prod use Cognito Hosted UI (federation) → the
  // client component auto-initiates the OAuth sign-up redirect. signIn must never
  // be called during this server render: it sets cookies, which Next.js forbids
  // outside a Server Action or Route Handler. (Mirrors login/page.tsx.)
  const isLocalDev = Boolean(process.env.COGNITO_ENDPOINT)

  return (
    <div className="auth-screen">
      <div className="auth-card glass">
        <div className="auth-brand">
          <WobblioLogo size={30} withWordmark />
        </div>
        {isLocalDev ? (
          <>
            <h1 className="auth-title">Create your account</h1>
            <p className="auth-sub">Start tracking your household in minutes.</p>
            <RegisterForm />
            <p className="auth-foot">
              Already have an account?{' '}
              <Link href="/login" className="auth-link strong">
                Sign in
              </Link>
            </p>
          </>
        ) : (
          <HostedUiSignupRedirect />
        )}
      </div>
      <p className="auth-legal">
        <ShieldCheck size={14} /> Protected by row-level security · GDPR-compliant · EU-hosted
      </p>
    </div>
  )
}
