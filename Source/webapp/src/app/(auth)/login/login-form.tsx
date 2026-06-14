'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Lock, LogIn, Mail, ScanLine } from 'lucide-react'
import { Button } from '@/components/ds/Button'
import { Checkbox } from '@/components/ds/Checkbox'
import { Input } from '@/components/ds/Input'

export function LoginForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const form = new FormData(e.currentTarget)
    const result = await signIn('credentials', {
      email: form.get('email'),
      password: form.get('password'),
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      setError('Invalid email or password.')
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="auth-form" data-testid="login-form" noValidate>
        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          icon={<Mail size={16} />}
          required
          data-testid="login-email"
        />
        <Input
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          icon={<Lock size={16} />}
          required
          data-testid="login-password"
        />

        <div className="auth-row">
          <Checkbox name="remember" defaultChecked label="Remember me" />
          <Link href="/forgot-password" className="auth-link">
            Forgot your password?
          </Link>
        </div>

        {error && (
          <p role="alert" className="field-error" data-testid="login-error">
            {error}
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          disabled={loading}
          style={{ width: '100%' }}
          iconLeft={loading ? null : <LogIn size={16} />}
          data-testid="login-submit"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <div className="auth-divider">
        <span>or</span>
      </div>

      <button
        type="button"
        className="sso-btn"
        onClick={() => signIn('cognito', { callbackUrl: '/dashboard' })}
      >
        <ScanLine size={16} /> Continue with single sign-on
      </button>

      <p className="auth-foot">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="auth-link strong">
          Create one
        </Link>
      </p>
    </>
  )
}
