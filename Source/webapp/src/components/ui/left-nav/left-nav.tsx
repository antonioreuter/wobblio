'use client'

import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  ReceiptText,
  BarChart3,
  ShoppingCart,
  Wallet,
  Users,
  Settings,
  Menu,
  X,
} from 'lucide-react'
import { NavItem } from '@/components/ui/nav-item'
import { cn } from '@/lib/cn'

type NavPage =
  | 'dashboard'
  | 'invoices'
  | 'reports'
  | 'lists'
  | 'budgets'
  | 'household'
  | 'settings'

interface LeftNavProps {
  activePage?: NavPage
  onNavigate?: (page: NavPage) => void
  className?: string
}

const navItems: { page: NavPage; icon: LucideIcon; label: string }[] = [
  { page: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { page: 'invoices', icon: ReceiptText, label: 'Invoices' },
  { page: 'reports', icon: BarChart3, label: 'Reports' },
  { page: 'lists', icon: ShoppingCart, label: 'Shopping Lists' },
  { page: 'budgets', icon: Wallet, label: 'Budgets' },
  { page: 'household', icon: Users, label: 'Household' },
]

export function LeftNav({ activePage, onNavigate, className }: LeftNavProps) {
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
        {navItems.map(({ page, icon, label }) => (
          <NavItem
            key={page}
            icon={icon}
            label={label}
            active={activePage === page}
            collapsed={collapsed}
            onClick={() => onNavigate?.(page)}
          />
        ))}
      </div>

      {/* Bottom items */}
      <div className="flex flex-col gap-0.5 border-t border-[#e2e8f0] p-2 dark:border-[#334155]">
        <NavItem
          icon={Settings}
          label="Settings"
          active={activePage === 'settings'}
          collapsed={collapsed}
          onClick={() => onNavigate?.('settings')}
        />
      </div>
    </nav>
  )
}
