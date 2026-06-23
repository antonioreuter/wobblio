'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AlertCircle, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// Cognito sign-in. On AWS the OAuth (Hosted UI) provider is used; against
// cognito-local the email/password credentials provider is active. Non-ADMIN users
// authenticate fine but the middleware then bounces them to /403.
const HAS_LOCAL_CREDENTIALS = process.env.NEXT_PUBLIC_AUTH_LOCAL === 'true'

export function LoginForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleCredentials(e: React.FormEvent<HTMLFormElement>) {
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
    router.push('/')
    router.refresh()
  }

  if (!HAS_LOCAL_CREDENTIALS) {
    return (
      <Button
        className="w-full"
        data-testid="login-cognito"
        onClick={() => signIn('cognito', { callbackUrl: '/' })}
      >
        <LogIn size={16} strokeWidth={1.5} />
        Sign in with Cognito
      </Button>
    )
  }

  return (
    <form onSubmit={handleCredentials} className="flex flex-col gap-4" data-testid="login-form" noValidate>
      <Input label="Email" type="email" name="email" autoComplete="email" required data-testid="login-email" />
      <Input
        label="Password"
        type="password"
        name="password"
        autoComplete="current-password"
        required
        data-testid="login-password"
      />
      {error && (
        <p className="flex items-center gap-1.5 text-xs text-danger" role="alert">
          <AlertCircle size={14} strokeWidth={1.5} />
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={loading} data-testid="login-submit">
        <LogIn size={16} strokeWidth={1.5} />
        {loading ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  )
}
