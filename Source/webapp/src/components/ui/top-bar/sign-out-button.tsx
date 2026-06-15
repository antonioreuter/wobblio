'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { federatedSignOut } from '@/lib/federated-sign-out'
import { SignOutConfirmDialog } from './sign-out-confirm-dialog'

export function SignOutButton() {
  const [confirming, setConfirming] = useState(false)

  return (
    <>
      <button
        type="button"
        className="signout-btn has-tip has-tip--bottom"
        data-tip="Sign out"
        onClick={() => setConfirming(true)}
        aria-label="Sign out"
        data-testid="signout-button"
      >
        <LogOut size={16} />
      </button>
      {confirming && (
        <SignOutConfirmDialog
          onConfirm={() => void federatedSignOut()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  )
}
