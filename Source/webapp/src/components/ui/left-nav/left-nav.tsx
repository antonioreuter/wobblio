'use client'

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
} from 'lucide-react'
import { WobblioLogo } from '@/components/ds'

interface LeftNavProps {
  userRole?: string
}

const PRIMARY_NAV = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/invoices', icon: ReceiptText, label: 'Invoices' },
  { href: '/review', icon: CheckSquare, label: 'Awaiting Check' },
  { href: '/reports', icon: LineChart, label: 'Price Trends' },
  { href: '/lists', icon: ShoppingCart, label: 'Shopping Lists' },
  { href: '/budgets', icon: Wallet, label: 'Budgets' },
  { href: '/household', icon: Users, label: 'Household' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

export function LeftNav({ userRole }: LeftNavProps) {
  const pathname = usePathname() ?? ''

  return (
    <aside className="app-rail">
      <Link href="/dashboard" className="rail-logo" aria-label="Wobblio">
        <WobblioLogo size={30} />
      </Link>
      <nav className="rail-menu" aria-label="App navigation">
        {PRIMARY_NAV.map(({ href, icon: Icon, label }) => {
          const isActive = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`rail-btn has-tip ${isActive ? 'active' : ''}`}
              data-tip={label}
              aria-label={label}
              data-testid={`nav-${href.slice(1)}`}
            >
              <Icon size={20} />
            </Link>
          )
        })}
        {userRole === 'ADMIN' && (
          <Link
            href="/admin"
            className={`rail-btn has-tip ${pathname.startsWith('/admin') ? 'active' : ''}`}
            data-tip="Console"
            aria-label="Admin"
            data-testid="nav-admin"
          >
            <Terminal size={20} />
          </Link>
        )}
      </nav>
    </aside>
  )
}
