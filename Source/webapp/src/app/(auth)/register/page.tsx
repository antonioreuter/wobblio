import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import { WobblioLogo } from '@/components/ds/WobblioLogo'
import { RegisterForm } from './register-form'

export const metadata = { title: 'Create account — Wobblio' }

export default function RegisterPage() {
  return (
    <div className="auth-screen">
      <div className="auth-card glass">
        <div className="auth-brand">
          <WobblioLogo size={30} withWordmark />
        </div>
        <h1 className="auth-title">Create your account</h1>
        <p className="auth-sub">Start tracking your household in minutes.</p>
        <RegisterForm />
        <p className="auth-foot">
          Already have an account?{' '}
          <Link href="/login" className="auth-link strong">
            Sign in
          </Link>
        </p>
      </div>
      <p className="auth-legal">
        <ShieldCheck size={14} /> Protected by row-level security · GDPR-compliant · EU-hosted
      </p>
    </div>
  )
}
