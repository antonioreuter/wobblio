'use client'

import { usePathname } from 'next/navigation'
import { Crown, ReceiptText } from 'lucide-react'
import { Avatar } from '@/components/ds'
import { SignOutButton } from './sign-out-button'

interface TopBarProps {
  usageUsed?: number
  usageLimit?: number
  userInitials?: string
  userPlan?: string
}

const ROUTE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/invoices': 'Invoices',
  '/review': 'Awaiting Check',
  '/reports': 'Price Trends',
  '/lists': 'Shopping Lists',
  '/budgets': 'Budgets',
  '/household': 'Household',
  '/settings': 'Settings',
  '/admin': 'Console',
}

function deriveTitle(pathname: string): string {
  const match = Object.keys(ROUTE_TITLES).find((p) => pathname.startsWith(p))
  return match ? ROUTE_TITLES[match] : 'Workspace'
}

export function TopBar({
  usageUsed = 0,
  usageLimit = 15,
  userInitials = 'AR',
  userPlan = 'Premium',
}: TopBarProps) {
  const pathname = usePathname() ?? '/dashboard'
  const title = deriveTitle(pathname)
  const pct = Math.max(0, Math.min(100, (usageUsed / Math.max(1, usageLimit)) * 100))

  return (
    <header className="app-topbar">
      <h1 className="topbar-title" data-testid="topbar-title">
        {title}
      </h1>
      <div className="topbar-right">
        <div className="usage-chip" data-testid="topbar-usage" title="Invoices processed this week">
          <span className="usage-icon">
            <ReceiptText size={16} />
          </span>
          <div className="usage-meta">
            <div className="usage-top">
              <span className="usage-label">Invoices this week</span>
              <span className="usage-count">
                <strong>{usageUsed}</strong> / {usageLimit}
              </span>
            </div>
            <div className="usage-bar">
              <div className="usage-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
        <div className="user-chip" data-testid="topbar-user">
          <Avatar initials={userInitials} aria-label={userPlan} />
          <div className="user-meta">
            <span className="user-plan">
              <Crown size={10} /> {userPlan}
            </span>
          </div>
        </div>
        <SignOutButton />
      </div>
    </header>
  )
}
