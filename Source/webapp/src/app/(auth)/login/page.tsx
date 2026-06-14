import { redirect } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { auth, signIn } from '@/auth'
import { WobblioLogo } from '@/components/ds/WobblioLogo'
import { LoginForm } from './login-form'

export const metadata = { title: 'Sign in — Wobblio' }

export default async function LoginPage() {
  const session = await auth()
  if (session) redirect('/dashboard')

  const isLocalDev = Boolean(process.env.COGNITO_ENDPOINT)

  if (!isLocalDev) {
    await signIn('cognito', { redirectTo: '/dashboard' })
  }

  return (
    <div className="auth-screen">
      <div className="auth-card glass">
        <div className="auth-brand">
          <WobblioLogo size={30} withWordmark />
        </div>
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-sub">Sign in to your household workspace.</p>
        <LoginForm />
      </div>
      <p className="auth-legal">
        <ShieldCheck size={14} /> Protected by row-level security · GDPR-compliant · EU-hosted
      </p>
    </div>
  )
}
