import { redirect } from 'next/navigation'
import { auth, signIn } from '@/auth'
import { LoginForm } from './login-form'

export const metadata = { title: 'Sign in — Wobblio' }

export default async function LoginPage() {
  const session = await auth()
  if (session) redirect('/dashboard')

  const isLocalDev = Boolean(process.env.COGNITO_ENDPOINT)

  if (!isLocalDev) {
    await signIn('cognito', { redirectTo: '/dashboard' })
  }

  return (
    <div className="w-full max-w-md rounded-[12px] border border-[#E2E8F0] bg-white p-8 shadow-sm dark:border-[#1E293B] dark:bg-[#111827]">
      <div className="mb-8 text-center">
        <span className="text-2xl font-semibold tracking-tight text-[#0D9488]">wobblio</span>
      </div>
      <h1 className="mb-6 text-[30px] font-semibold leading-tight text-[#0F172A] dark:text-[#F1F5F9]">
        Welcome back
      </h1>
      <LoginForm />
    </div>
  )
}
