'use client'

import { useEffect, useRef, useState } from 'react'
import { Crown, LogOut } from 'lucide-react'
import { signOut } from 'next-auth/react'
import { Avatar } from '@/components/ds'
import { SignOutConfirmDialog } from './sign-out-confirm-dialog'

interface UserMenuProps {
  userInitials: string
  userPlan: string
}

export function UserMenu({ userInitials, userPlan }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="user-menu" ref={ref}>
      <span className="plan-chip" data-testid="topbar-plan">
        <Crown size={11} /> {userPlan}
      </span>
      <button
        type="button"
        className="user-menu-trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        data-testid="user-menu-trigger"
      >
        <Avatar initials={userInitials} aria-label={userPlan} />
      </button>
      {open && (
        <div className="user-menu-pop" role="menu" data-testid="user-menu-pop">
          <button
            type="button"
            className="user-menu-item"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              setConfirming(true)
            }}
            data-testid="signout-button"
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      )}
      {confirming && (
        <SignOutConfirmDialog
          onConfirm={() => signOut({ callbackUrl: '/' })}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  )
}
