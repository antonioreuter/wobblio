import { Shield } from 'lucide-react'

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <Shield size={40} strokeWidth={1.5} className="text-danger" aria-hidden />
      <h1 className="text-2xl font-bold text-fg">Access denied</h1>
      <p className="max-w-sm text-sm text-muted">
        This console is restricted to Wobblio administrators. If you believe this is an error,
        contact your administrator.
      </p>
    </div>
  )
}
