'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

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
    <form onSubmit={handleSubmit} data-testid="login-form" noValidate>
      <div className="mb-4">
        <label
          htmlFor="email"
          className="mb-1 block text-sm font-medium text-[#0F172A] dark:text-[#F1F5F9]"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          data-testid="login-email"
          className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[16px] text-[#0F172A] outline-none transition focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] dark:border-[#1E293B] dark:bg-[#0B0F19] dark:text-[#F1F5F9]"
        />
      </div>

      <div className="mb-6">
        <label
          htmlFor="password"
          className="mb-1 block text-sm font-medium text-[#0F172A] dark:text-[#F1F5F9]"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          data-testid="login-password"
          className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[16px] text-[#0F172A] outline-none transition focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] dark:border-[#1E293B] dark:bg-[#0B0F19] dark:text-[#F1F5F9]"
        />
      </div>

      {error && (
        <p
          role="alert"
          data-testid="login-error"
          className="mb-4 text-sm text-[#DC2626]"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        data-testid="login-submit"
        className="w-full rounded-lg bg-[#0D9488] px-4 py-2.5 text-[16px] font-medium text-white transition hover:bg-[#0F766E] disabled:opacity-60"
      >
        {loading ? 'Signing in…' : 'Sign in'}
      </button>

      <div className="mt-5 flex flex-col gap-2 text-center text-sm text-[#64748B] dark:text-[#94A3B8]">
        <Link
          href="/forgot-password"
          className="hover:text-[#0D9488] hover:underline"
        >
          Forgot your password?
        </Link>
        <span>
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-medium text-[#0D9488] hover:underline">
            Create one
          </Link>
        </span>
      </div>
    </form>
  )
}
