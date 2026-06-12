import Link from 'next/link'
import { ForgotPasswordForm } from './forgot-password-form'

export const metadata = { title: 'Reset password — Wobblio' }

export default function ForgotPasswordPage() {
  return (
    <div className="w-full max-w-md rounded-[12px] border border-[#E2E8F0] bg-white p-8 shadow-sm dark:border-[#1E293B] dark:bg-[#111827]">
      <div className="mb-8 text-center">
        <Link href="/" className="text-2xl font-semibold tracking-tight text-[#0D9488]">
          wobblio
        </Link>
      </div>
      <ForgotPasswordForm />
      <p className="mt-5 text-center text-sm text-[#64748B] dark:text-[#94A3B8]">
        <Link href="/login" className="font-medium text-[#0D9488] hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  )
}
