'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { AlertCircle, Lock, Mail, UserPlus } from 'lucide-react'
import { Button } from '@/components/ds/Button'
import { Input } from '@/components/ds/Input'
import { registerUser } from '../actions'

function scorePassword(pw: string): 0 | 1 | 2 | 3 | 4 {
  if (!pw) return 0
  let s = 0
  if (pw.length >= 8) s++
  if (pw.length >= 12) s++
  if (/[0-9]/.test(pw) && /[a-z]/.test(pw)) s++
  if (/[A-Z]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++
  return Math.min(4, s) as 0 | 1 | 2 | 3 | 4
}

const STRENGTH = [
  { label: '', tone: '' as const },
  { label: 'Weak', tone: 'danger' as const },
  { label: 'Fair', tone: 'warning' as const },
  { label: 'Good', tone: 'warning' as const },
  { label: 'Strong', tone: 'success' as const },
]

export function RegisterForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')

  const score = scorePassword(pw)
  const meter = STRENGTH[score]
  const mismatch = confirm.length > 0 && confirm !== pw

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const form = new FormData(e.currentTarget)
    const email = form.get('email') as string
    const password = form.get('password') as string

    // Mismatch is surfaced inline under the confirm field; don't duplicate it
    // as a form-level banner — just block the submit.
    if (password !== form.get('confirm')) {
      setLoading(false)
      return
    }

    const result = await registerUser(email, password)
    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    const signInResult = await signIn('credentials', { email, password, redirect: false })
    setLoading(false)

    if (signInResult?.error) {
      router.push('/login?registered=1')
      return
    }

    // Profile is captured next in the onboarding step (the app-layout gate
    // redirects there until it is complete).
    router.push('/onboarding')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form" data-testid="register-form" noValidate>
      <Input
        label="Email"
        type="email"
        name="email"
        autoComplete="email"
        icon={<Mail size={16} />}
        placeholder="you@example.com"
        required
        data-testid="register-email"
      />

      <div className="pw-field">
        <Input
          label="Password"
          type="password"
          name="password"
          autoComplete="new-password"
          icon={<Lock size={16} />}
          placeholder="At least 12 characters"
          required
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          data-testid="register-password"
        />
        <div className="pw-meter" aria-hidden>
          <div className="pw-track">
            {[1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={`pw-seg ${i <= score && meter.tone ? `on tone-${meter.tone}` : ''}`}
              />
            ))}
          </div>
          {meter.label && (
            <span className="pw-label" style={{ color: `var(--${meter.tone})` }}>
              {meter.label}
            </span>
          )}
        </div>
        <p className="field-hint">
          Min. 12 characters with uppercase, lowercase, number, and symbol.
        </p>
      </div>

      <div className="pw-field">
        <Input
          label="Confirm password"
          type="password"
          name="confirm"
          autoComplete="new-password"
          icon={<Lock size={16} />}
          placeholder="Re-enter your password"
          required
          flagged={mismatch}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          data-testid="register-confirm"
        />
        {mismatch && (
          <span className="field-error" data-testid="register-mismatch">
            Passwords don&apos;t match.
          </span>
        )}
      </div>

      {error && (
        <div role="alert" className="auth-alert" data-testid="register-error">
          <AlertCircle size={16} />
          <span className="auth-alert-msg">{error}</span>
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        disabled={loading}
        style={{ width: '100%' }}
        iconLeft={loading ? null : <UserPlus size={16} />}
        data-testid="register-submit"
      >
        {loading ? 'Creating account…' : 'Create account'}
      </Button>
    </form>
  )
}
