'use client'

import { LogOut } from 'lucide-react'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'

export function SignOutButton() {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => signOut({ callbackUrl: '/login' })}
      data-testid="sign-out"
    >
      <LogOut size={14} strokeWidth={1.5} /> Sign out
    </Button>
  )
}
