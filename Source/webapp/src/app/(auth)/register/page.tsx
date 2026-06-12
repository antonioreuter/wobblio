import Link from 'next/link'
import { RegisterForm } from './register-form'

export const metadata = { title: 'Create account — Wobblio' }

export default function RegisterPage() {
  return (
    <div className="w-full max-w-md rounded-[12px] border border-[#E2E8F0] bg-white p-8 shadow-sm dark:border-[#1E293B] dark:bg-[#111827]">
      <div className="mb-8 text-center">
        <Link href="/" className="text-2xl font-semibold tracking-tight text-[#0D9488]">
          wobblio
        </Link>
      </div>
      <h1 className="mb-2 text-[30px] font-semibold leading-tight text-[#0F172A] dark:text-[#F1F5F9]">
        Create your account
      </h1>
      <p className="mb-6 text-sm text-[#64748B] dark:text-[#94A3B8]">
        Free to start. No bank access. Ever.
      </p>
      <RegisterForm />
      <p className="mt-5 text-center text-sm text-[#64748B] dark:text-[#94A3B8]">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-[#0D9488] hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
