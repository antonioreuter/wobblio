'use client'

import { AlertTriangle } from 'lucide-react'
import { useSandbox } from '@/components/providers/sandbox-provider'

export function RlsWarningBanner() {
  const { showWarningBanner, dismissWarningBanner, isRlsEnforced } = useSandbox()

  if (isRlsEnforced || !showWarningBanner) return null

  return (
    <div className="rls-banner" role="alert" data-testid="rls-warning-banner">
      <AlertTriangle size={18} />
      <span className="msg">
        <strong>PostgreSQL tenant separation bypass warning:</strong> Query attempted to access
        data from user <code>usr_9a4f210e</code>. Operation blocked by RLS policies.
      </span>
      <button
        type="button"
        onClick={dismissWarningBanner}
        aria-label="Dismiss warning banner"
      >
        ×
      </button>
    </div>
  )
}
