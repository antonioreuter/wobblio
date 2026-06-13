'use client'

import { LogOut } from 'lucide-react'
import { signOut } from 'next-auth/react'

export function SignOutButton() {
  return (
    <button
      type="button"
      className="signout-btn has-tip has-tip--bottom"
      data-tip="Sign out"
      onClick={() => signOut({ callbackUrl: '/' })}
      aria-label="Sign out"
      data-testid="signout-button"
    >
      <LogOut size={16} />
    </button>
  )
}
