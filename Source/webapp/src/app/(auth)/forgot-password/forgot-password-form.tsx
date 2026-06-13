'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Lock, Mail, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ds/Button'
import { Input } from '@/components/ds/Input'
import { confirmPasswordReset, sendPasswordResetCode } from '../actions'

type Step = 'email' | 'reset'

export function ForgotPasswordForm() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleEmailSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const form = new FormData(e.currentTarget)
    const submittedEmail = form.get('email') as string
    const result = await sendPasswordResetCode(submittedEmail)

    setLoading(false)

    if (result.error) {
      setError(result.error)
      return
    }

    setEmail(submittedEmail)
    setStep('reset')
  }

  async function handleResetSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const form = new FormData(e.currentTarget)
    const password = form.get('password') as string
    const confirm = form.get('confirm') as string

    if (password !== confirm) {
      setError('Passwords do not match.')
      setLoading(false)
      return
    }

    const result = await confirmPasswordReset(email, form.get('code') as string, password)
    setLoading(false)

    if (result.error) {
      setError(result.error)
      return
    }

    router.push('/login?reset=1')
  }

  if (step === 'email') {
    return (
      <>
        <h1 className="auth-title">Reset your password</h1>
        <p className="auth-sub">Enter your email and we&apos;ll send you a reset code.</p>
        <form
          onSubmit={handleEmailSubmit}
          className="auth-form"
          data-testid="forgot-email-form"
          noValidate
        >
          <Input
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            icon={<Mail size={16} />}
            required
            data-testid="forgot-email"
          />
          {error && (
            <p role="alert" className="field-error" data-testid="forgot-error">
              {error}
            </p>
          )}
          <Button
            type="submit"
            variant="primary"
            disabled={loading}
            style={{ width: '100%' }}
            iconLeft={loading ? null : <ArrowRight size={16} />}
            data-testid="forgot-submit"
          >
            {loading ? 'Sending…' : 'Send reset code'}
          </Button>
        </form>
      </>
    )
  }

  return (
    <>
      <h1 className="auth-title">Enter reset code</h1>
      <p className="auth-sub">
        Check your email at{' '}
        <strong style={{ color: 'var(--text-primary)' }}>{email}</strong> for the 6-digit code.
      </p>
      <form onSubmit={handleResetSubmit} className="auth-form" data-testid="reset-form" noValidate>
        <Input
          label="Verification code"
          type="text"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          icon={<ShieldCheck size={16} />}
          style={{ letterSpacing: '0.5em', fontFamily: 'var(--font-display)' }}
          data-testid="reset-code"
        />
        <Input
          label="New password"
          type="password"
          name="password"
          autoComplete="new-password"
          icon={<Lock size={16} />}
          required
          data-testid="reset-password"
        />
        <Input
          label="Confirm password"
          type="password"
          name="confirm"
          autoComplete="new-password"
          icon={<Lock size={16} />}
          required
          data-testid="reset-confirm"
        />
        <p className="field-hint">
          Min. 12 characters with uppercase, lowercase, number, and symbol.
        </p>
        {error && (
          <p role="alert" className="field-error" data-testid="reset-error">
            {error}
          </p>
        )}
        <Button
          type="submit"
          variant="primary"
          disabled={loading}
          style={{ width: '100%' }}
          iconLeft={loading ? null : <ShieldCheck size={16} />}
          data-testid="reset-submit"
        >
          {loading ? 'Resetting…' : 'Reset password'}
        </Button>
        <button
          type="button"
          onClick={() => {
            setStep('email')
            setError(null)
          }}
          className="auth-link"
          style={{ background: 'none', border: 0, cursor: 'pointer', marginTop: 4 }}
        >
          Use a different email
        </button>
      </form>
    </>
  )
}
