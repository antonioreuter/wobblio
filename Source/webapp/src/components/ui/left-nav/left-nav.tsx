'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  ReceiptText,
  BarChart3,
  ShoppingCart,
  Wallet,
  Users,
  Settings,
  Shield,
  Menu,
  X,
} from 'lucide-react'
import { NavItem } from '@/components/ui/nav-item'
import { cn } from '@/lib/cn'

interface LeftNavProps {
  userRole?: string
  className?: string
}

const navItems: { href: string; icon: LucideIcon; label: string }[] = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/invoices', icon: ReceiptText, label: 'Invoices' },
  { href: '/reports', icon: BarChart3, label: 'Reports' },
  { href: '/lists', icon: ShoppingCart, label: 'Shopping Lists' },
  { href: '/budgets', icon: Wallet, label: 'Budgets' },
  { href: '/household', icon: Users, label: 'Household' },
]

export function LeftNav({ userRole, className }: LeftNavProps) {
  const pathname = usePathname() ?? ''
  const [collapsed, setCollapsed] = useState(false)

  return (
    <nav
      className={cn(
        'flex h-full flex-col border-r border-[#e2e8f0] bg-white transition-all dark:border-[#334155] dark:bg-[#111827]',
        collapsed ? 'w-14' : 'w-60',
        className
      )}
      aria-label="Main navigation"
    >
      {/* Header */}
      <div
        className={cn(
          'flex h-14 items-center border-b border-[#e2e8f0] px-3 dark:border-[#334155]',
          collapsed ? 'justify-center' : 'justify-between'
        )}
      >
        {!collapsed && (
          <span className="text-base font-bold text-[#0d9488]">Wobblio</span>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="rounded p-1 text-[#64748b] hover:text-[#0f172a] dark:text-[#94a3b8] dark:hover:text-[#f1f5f9]"
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          {collapsed ? <Menu size={18} strokeWidth={1.5} /> : <X size={18} strokeWidth={1.5} />}
        </button>
      </div>

      {/* Nav items */}
      <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {navItems.map(({ href, icon, label }) => (
          <NavItem
            key={href}
            href={href}
            icon={icon}
            label={label}
            active={pathname.startsWith(href)}
            collapsed={collapsed}
          />
        ))}
      </div>

      {/* Bottom items */}
      <div className="flex flex-col gap-0.5 border-t border-[#e2e8f0] p-2 dark:border-[#334155]">
        <NavItem
          href="/settings"
          icon={Settings}
          label="Settings"
          active={pathname.startsWith('/settings')}
          collapsed={collapsed}
        />
        {userRole === 'ADMIN' && (
          <NavItem
            href="/admin"
            icon={Shield}
            label="Admin"
            active={pathname.startsWith('/admin')}
            collapsed={collapsed}
          />
        )}
      </div>
    </nav>
  )
}
