import { Shield } from 'lucide-react'

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <Shield size={40} strokeWidth={1.5} className="text-[#dc2626]" aria-hidden />
      <h1 className="text-2xl font-bold text-[#0f172a]">Access denied</h1>
      <p className="max-w-sm text-sm text-[#64748b]">
        This console is restricted to Wobblio administrators. If you believe this is an error,
        contact your administrator.
      </p>
    </div>
  )
}
