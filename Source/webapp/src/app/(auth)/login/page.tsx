import { redirect } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { auth } from '@/auth'
import { WobblioLogo } from '@/components/ds/WobblioLogo'
import { LoginForm } from './login-form'
import { HostedUiRedirect } from './hosted-ui-redirect'

export const metadata = { title: 'Sign in — Wobblio' }

export default async function LoginPage() {
  const session = await auth()
  // Only redirect a genuinely valid session away from /login. A session whose
  // silent refresh failed (RefreshAccessTokenError) is treated as logged-out by
  // the app gate; redirecting it to /dashboard would bounce straight back here
  // (ERR_TOO_MANY_REDIRECTS).
  if (session?.user && session.error !== 'RefreshAccessTokenError') redirect('/dashboard')

  // Local dev runs cognito-local with a credentials provider → render the
  // email/password form. Dev/prod use Cognito Hosted UI (federation) → the
  // client component auto-initiates the OAuth redirect. signIn must never be
  // called during this server render: it sets cookies, which Next.js forbids
  // outside a Server Action or Route Handler.
  const isLocalDev = Boolean(process.env.COGNITO_ENDPOINT)

  return (
    <div className="auth-screen">
      <div className="auth-card glass">
        <div className="auth-brand">
          <WobblioLogo size={30} withWordmark />
        </div>
        {isLocalDev ? (
          <>
            <h1 className="auth-title">Welcome back</h1>
            <p className="auth-sub">Sign in to your household workspace.</p>
            <LoginForm />
          </>
        ) : (
          <HostedUiRedirect />
        )}
      </div>
      <p className="auth-legal">
        <ShieldCheck size={14} /> Protected by row-level security · GDPR-compliant · EU-hosted
      </p>
    </div>
  )
}
