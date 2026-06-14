'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  CheckSquare,
  LayoutDashboard,
  LineChart,
  ReceiptText,
  Settings,
  ShoppingCart,
  Terminal,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { WobblioLogo } from '@/components/ds'
import { useNavDrawer } from './nav-drawer-context'

interface LeftNavProps {
  userRole?: string
}

interface NavItem {
  href: string
  icon: typeof LayoutDashboard
  label: string
  ariaLabel?: string
}

const PRIMARY_NAV: NavItem[] = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/invoices', icon: ReceiptText, label: 'Invoices' },
  { href: '/review', icon: CheckSquare, label: 'Awaiting Check' },
  { href: '/reports', icon: LineChart, label: 'Price Trends' },
  { href: '/lists', icon: ShoppingCart, label: 'Shopping Lists' },
  { href: '/budgets', icon: Wallet, label: 'Budgets' },
  { href: '/household', icon: Users, label: 'Household' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

const ADMIN_NAV: NavItem = {
  href: '/admin',
  icon: Terminal,
  label: 'Console',
  ariaLabel: 'Admin',
}

function NavLinks({
  userRole,
  variant,
  onNavigate,
}: {
  userRole?: string
  variant: 'rail' | 'drawer'
  onNavigate?: () => void
}) {
  const pathname = usePathname() ?? ''
  const items = userRole === 'ADMIN' ? [...PRIMARY_NAV, ADMIN_NAV] : PRIMARY_NAV

  return (
    <>
      {items.map(({ href, icon: Icon, label, ariaLabel }) => {
        const isActive = pathname.startsWith(href)
        const testId = `nav-${href.slice(1)}`
        if (variant === 'drawer') {
          return (
            <Link
              key={href}
              href={href}
              className={`drawer-nav-btn ${isActive ? 'active' : ''}`}
              aria-label={ariaLabel ?? label}
              data-testid={testId}
              onClick={onNavigate}
            >
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          )
        }
        return (
          <Link
            key={href}
            href={href}
            className={`rail-btn has-tip ${isActive ? 'active' : ''}`}
            data-tip={label}
            aria-label={ariaLabel ?? label}
            data-testid={testId}
          >
            <Icon size={20} />
          </Link>
        )
      })}
    </>
  )
}

export function LeftNav({ userRole }: LeftNavProps) {
  return (
    <aside className="app-rail">
      <Link href="/dashboard" className="rail-logo" aria-label="Wobblio">
        <WobblioLogo size={30} />
      </Link>
      <nav className="rail-menu" aria-label="App navigation">
        <NavLinks userRole={userRole} variant="rail" />
      </nav>
    </aside>
  )
}

export function LeftNavDrawer({ userRole }: LeftNavProps) {
  const { open, closeDrawer } = useNavDrawer()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, closeDrawer])

  return (
    <>
      <div
        className={`app-rail-backdrop ${open ? 'open' : ''}`}
        onClick={closeDrawer}
        aria-hidden="true"
      />
      <aside
        className={`app-rail-drawer ${open ? 'open' : ''}`}
        aria-label="App navigation"
        aria-hidden={!open}
        inert={!open}
        data-testid="nav-drawer"
      >
        <div className="drawer-head">
          <Link href="/dashboard" className="rail-logo" aria-label="Wobblio" onClick={closeDrawer}>
            <WobblioLogo size={28} />
          </Link>
          <button
            type="button"
            className="drawer-close"
            onClick={closeDrawer}
            aria-label="Close navigation menu"
            data-testid="nav-drawer-close"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="drawer-menu" aria-label="App navigation">
          <NavLinks userRole={userRole} variant="drawer" onNavigate={closeDrawer} />
        </nav>
      </aside>
    </>
  )
}
