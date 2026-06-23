import { Shield } from 'lucide-react'
import { LoginForm } from './login-form'

// Standalone sign-in (no console chrome). Reached when the middleware bounces an
// unauthenticated visitor; a successful ADMIN sign-in lands on the hub.
export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8fafc] p-6">
      <div className="w-full max-w-sm rounded-[12px] border border-[#e2e8f0] bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <Shield className="h-6 w-6 text-[#dc2626]" strokeWidth={1.5} />
          <h1 className="text-lg font-bold text-[#0f172a]">
            Wobblio <span className="text-[#dc2626]">Admin</span>
          </h1>
        </div>
        <LoginForm />
      </div>
    </main>
  )
}
