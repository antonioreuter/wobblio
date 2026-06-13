import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import { WobblioLogo } from '@/components/ds/WobblioLogo'
import { ForgotPasswordForm } from './forgot-password-form'

export const metadata = { title: 'Reset password — Wobblio' }

export default function ForgotPasswordPage() {
  return (
    <div className="auth-screen">
      <div className="auth-card glass">
        <div className="auth-brand">
          <WobblioLogo size={30} withWordmark />
        </div>
        <ForgotPasswordForm />
        <p className="auth-foot">
          <Link href="/login" className="auth-link strong">
            Back to sign in
          </Link>
        </p>
      </div>
      <p className="auth-legal">
        <ShieldCheck size={14} /> Protected by row-level security · GDPR-compliant · EU-hosted
      </p>
    </div>
  )
}
