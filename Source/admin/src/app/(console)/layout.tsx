'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  SlidersHorizontal,
  Stethoscope,
  Package,
  Store,
  GitMerge,
  Coins,
  Users,
  Wrench,
  Menu,
  X,
  type LucideIcon,
} from 'lucide-react'
import { WobblioLogo } from '@/components/ui/logo'
import { SignOutButton } from '@/components/ui/sign-out-button'
import { ThemeToggle } from '@/components/ui/theme-toggle'

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/platform', label: 'Platform', icon: SlidersHorizontal },
  { href: '/troubleshooting', label: 'Troubleshooting', icon: Stethoscope },
  { href: '/faults', label: 'System Faults', icon: Wrench },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/curation/products', label: 'Product Curation', icon: Package },
  { href: '/curation/merchants', label: 'Merchant Curation', icon: Store },
  { href: '/curation/merges', label: 'Merge Audit', icon: GitMerge },
  { href: '/ai-spend', label: 'AI Spend', icon: Coins },
]

const isActive = (pathname: string, href: string): boolean =>
  href === '/' ? pathname === '/' : pathname.startsWith(href)

function pageTitle(pathname: string): string {
  const match = [...NAV_ITEMS].reverse().find((i) => isActive(pathname, i.href))
  return match?.label ?? 'Admin Console'
}

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/'
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="grid h-screen grid-cols-1 overflow-hidden bg-bg md:grid-cols-[76px_1fr]">
      {/* Desktop icon rail (mirrors the webapp) */}
      <aside className="app-rail hidden md:flex" aria-label="Admin navigation">
        <Link href="/" className="rail-logo" aria-label="Wobblio Admin">
          <WobblioLogo className="h-7 w-7" />
        </Link>
        <nav className="rail-menu">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="rail-btn has-tip"
              data-tip={label}
              data-active={isActive(pathname, href)}
              aria-label={label}
              data-testid={`nav-${href === '/' ? 'hub' : href.slice(1)}`}
            >
              <Icon size={20} strokeWidth={1.5} />
            </Link>
          ))}
        </nav>
      </aside>

      {/* Mobile drawer + backdrop */}
      <div
        className={`app-rail-backdrop ${drawerOpen ? 'open' : ''} md:hidden`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />
      <aside
        className={`app-rail-drawer ${drawerOpen ? 'open' : ''} md:hidden`}
        aria-label="Admin navigation"
        aria-hidden={!drawerOpen}
        data-testid="nav-drawer"
      >
        <div className="flex items-center justify-between px-1">
          <Link href="/" className="flex items-center gap-2" onClick={() => setDrawerOpen(false)}>
            <WobblioLogo className="h-6 w-6" />
            <span className="font-semibold text-fg">
              wobbl<span className="text-brand">io</span>
              <span className="ml-1 rounded bg-danger-soft px-1 py-0.5 text-[10px] font-bold uppercase tracking-wider text-danger">
                admin
              </span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close navigation menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] text-muted hover:bg-elevated hover:text-fg"
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>
        <nav className="drawer-menu">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="drawer-nav-btn"
              data-active={isActive(pathname, href)}
              onClick={() => setDrawerOpen(false)}
            >
              <Icon size={18} strokeWidth={1.5} />
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-col overflow-hidden">
        <header className="app-topbar flex h-14 shrink-0 items-center gap-1 border-b px-4 md:px-6">
          <button
            type="button"
            className="topbar-hamburger md:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
            data-testid="nav-hamburger"
          >
            <Menu size={20} strokeWidth={1.5} />
          </button>
          <h1 className="text-sm font-semibold text-fg">{pageTitle(pathname)}</h1>
          <span className="ml-auto mr-2 hidden text-xs text-muted lg:inline">admin.wobblio.com</span>
          <ThemeToggle />
          <SignOutButton />
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1440px] p-4 md:p-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
