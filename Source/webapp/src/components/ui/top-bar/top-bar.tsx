'use client'

import { usePathname } from 'next/navigation'
import { Menu, ReceiptText, Upload } from 'lucide-react'
import { ThemeToggle } from '@/components/ds'
import { useNavDrawer } from '@/components/ui/left-nav'
import { useWorkspace } from '@/components/workspace'
import { TopBarSearch } from './topbar-search'
import { NotificationMenu } from './notification-menu'
import { UserMenu } from './user-menu'

interface TopBarProps {
  userInitials?: string
  userRole?: string
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
  userInitials = 'AR',
  userRole = 'STANDARD',
}: TopBarProps) {
  const pathname = usePathname() ?? '/dashboard'
  const { toggleDrawer } = useNavDrawer()
  const { scanReceipt, usage } = useWorkspace()
  const title = deriveTitle(pathname)
  const usageUsed = usage?.used ?? 0
  const usageLimit = usage?.cap ?? 0
  const unlimited = usage?.unlimited ?? false
  const pct = unlimited ? 0 : Math.max(0, Math.min(100, (usageUsed / Math.max(1, usageLimit)) * 100))

  return (
    <header className="app-topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="topbar-hamburger"
          onClick={toggleDrawer}
          aria-label="Open navigation menu"
          data-testid="nav-hamburger"
        >
          <Menu size={20} />
        </button>
        <h1 className="topbar-title" data-testid="topbar-title">
          {title}
        </h1>
      </div>
      <TopBarSearch />
      <div className="topbar-right">
        <div className="usage-chip" data-testid="topbar-usage" title="Usage credits consumed this week">
          <span className="usage-icon">
            <ReceiptText size={16} />
          </span>
          <div className="usage-meta">
            <div className="usage-top">
              <span className="usage-label">Credits this week</span>
              <span className="usage-count">
                {usage ? <><strong>{usageUsed.toLocaleString()}</strong> / {unlimited ? '∞' : usageLimit.toLocaleString()}</> : '—'}
              </span>
            </div>
            <div className="usage-bar">
              <div className="usage-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
        <button
          type="button"
          className="btn btn--primary topbar-upload"
          onClick={scanReceipt}
          data-testid="topbar-upload"
        >
          <Upload size={15} />
          <span className="topbar-upload-label">Upload</span>
        </button>
        <NotificationMenu />
        <ThemeToggle className="btn-icon topbar-theme" />
        <UserMenu userInitials={userInitials} userRole={userRole} />
      </div>
    </header>
  )
}
