'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { sendPasswordResetCode, confirmPasswordReset } from '../actions'

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
        <h1 className="mb-2 text-[30px] font-semibold leading-tight text-[#0F172A] dark:text-[#F1F5F9]">
          Reset your password
        </h1>
        <p className="mb-6 text-sm text-[#64748B] dark:text-[#94A3B8]">
          Enter your email and we&apos;ll send a reset code.
        </p>
        <form onSubmit={handleEmailSubmit} data-testid="forgot-email-form" noValidate>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-[#0F172A] dark:text-[#F1F5F9]">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            data-testid="forgot-email"
            className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[16px] text-[#0F172A] outline-none transition focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] dark:border-[#1E293B] dark:bg-[#0B0F19] dark:text-[#F1F5F9]"
          />
          {error && (
            <p role="alert" data-testid="forgot-error" className="mt-3 text-sm text-[#DC2626]">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            data-testid="forgot-submit"
            className="mt-5 w-full rounded-lg bg-[#0D9488] px-4 py-2.5 text-[16px] font-medium text-white transition hover:bg-[#0F766E] disabled:opacity-60"
          >
            {loading ? 'Sending…' : 'Send reset code'}
          </button>
        </form>
      </>
    )
  }

  return (
    <>
      <h1 className="mb-2 text-[30px] font-semibold leading-tight text-[#0F172A] dark:text-[#F1F5F9]">
        Enter reset code
      </h1>
      <p className="mb-6 text-sm text-[#64748B] dark:text-[#94A3B8]">
        Check your email at <span className="font-medium text-[#0F172A] dark:text-[#F1F5F9]">{email}</span> for the 6-digit code.
      </p>
      <form onSubmit={handleResetSubmit} data-testid="reset-form" noValidate>
        <div className="flex flex-col gap-3">
          <div>
            <label htmlFor="code" className="mb-1 block text-sm font-medium text-[#0F172A] dark:text-[#F1F5F9]">
              Verification code
            </label>
            <input
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              data-testid="reset-code"
              className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[16px] tracking-widest text-[#0F172A] outline-none transition focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] dark:border-[#1E293B] dark:bg-[#0B0F19] dark:text-[#F1F5F9]"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-[#0F172A] dark:text-[#F1F5F9]">
              New password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              data-testid="reset-password"
              className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[16px] text-[#0F172A] outline-none transition focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] dark:border-[#1E293B] dark:bg-[#0B0F19] dark:text-[#F1F5F9]"
            />
          </div>
          <div>
            <label htmlFor="confirm" className="mb-1 block text-sm font-medium text-[#0F172A] dark:text-[#F1F5F9]">
              Confirm password
            </label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              data-testid="reset-confirm"
              className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[16px] text-[#0F172A] outline-none transition focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] dark:border-[#1E293B] dark:bg-[#0B0F19] dark:text-[#F1F5F9]"
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-[#64748B] dark:text-[#94A3B8]">
          Min. 12 characters with uppercase, lowercase, number, and symbol.
        </p>
        {error && (
          <p role="alert" data-testid="reset-error" className="mt-3 text-sm text-[#DC2626]">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          data-testid="reset-submit"
          className="mt-5 w-full rounded-lg bg-[#0D9488] px-4 py-2.5 text-[16px] font-medium text-white transition hover:bg-[#0F766E] disabled:opacity-60"
        >
          {loading ? 'Resetting…' : 'Reset password'}
        </button>
        <button
          type="button"
          onClick={() => { setStep('email'); setError(null) }}
          className="mt-2 w-full text-sm text-[#64748B] hover:text-[#0D9488] dark:text-[#94A3B8]"
        >
          Use a different email
        </button>
      </form>
    </>
  )
}
