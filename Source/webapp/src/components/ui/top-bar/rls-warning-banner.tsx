'use client'

import { AlertTriangle, X } from 'lucide-react'
import { useSandbox } from '@/components/providers/sandbox-provider'

export function RlsWarningBanner() {
  const { showWarningBanner, dismissWarningBanner, isRlsEnforced } = useSandbox()

  if (isRlsEnforced || !showWarningBanner) return null

  return (
    <div
      className="bg-rose-500/10 border-b border-rose-500/20 px-4 py-2.5 text-xs sm:text-sm text-rose-600 dark:text-rose-400 flex items-center gap-3 transition-all duration-300"
      role="alert"
    >
      <AlertTriangle size={16} className="shrink-0 text-rose-500" />
      <span className="flex-1 font-medium leading-tight">
        PostgreSQL tenant separation bypass warning: Current query attempted accessing data from user ID <code className="bg-rose-500/10 px-1 py-0.5 rounded font-mono text-[11px] sm:text-xs">usr_9a4f210e</code>. Operation blocked by RLS policies.
      </span>
      <button
        onClick={dismissWarningBanner}
        className="rounded-full p-1 hover:bg-rose-500/20 text-rose-500 transition-colors"
        aria-label="Dismiss warning banner"
      >
        <X size={14} />
      </button>
    </div>
  )
}
