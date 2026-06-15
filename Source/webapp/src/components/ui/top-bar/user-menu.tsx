'use client'

import { useEffect, useRef, useState, type ComponentType } from 'react'
import { CircleUser, Crown, FlaskConical, LogOut, ShieldCheck } from 'lucide-react'
import { Avatar } from '@/components/ds'
import { federatedSignOut } from '@/lib/federated-sign-out'
import { SignOutConfirmDialog } from './sign-out-confirm-dialog'

interface UserMenuProps {
  userInitials: string
  userRole: string
}

interface RoleBadge {
  label: string
  Icon: ComponentType<{ size?: number }>
  variant: string
}

// Role badge shown in the top bar. Icon + label always pair (never colour alone)
// per the design-system accessibility rule. Driven by the DB-sourced role.
const ROLE_BADGE: Record<string, RoleBadge> = {
  STANDARD: { label: 'Standard', Icon: CircleUser, variant: 'standard' },
  PREMIUM: { label: 'Premium', Icon: Crown, variant: 'premium' },
  TESTER: { label: 'Tester', Icon: FlaskConical, variant: 'tester' },
  ADMIN: { label: 'Admin', Icon: ShieldCheck, variant: 'admin' },
}

export function UserMenu({ userInitials, userRole }: UserMenuProps) {
  const badge = ROLE_BADGE[userRole] ?? ROLE_BADGE.STANDARD
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
      <span className={`plan-chip plan-chip--${badge.variant}`} data-testid="topbar-plan">
        <badge.Icon size={11} /> {badge.label}
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
        <Avatar initials={userInitials} aria-label={`${badge.label} account`} />
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
          onConfirm={() => federatedSignOut()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  )
}
