'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard,
  ReceiptText,
  ShoppingCart,
  Settings,
  CheckSquare,
  LineChart,
  Wallet,
  Users,
  Terminal,
  MoreHorizontal,
  X,
} from 'lucide-react'
import { cn } from '@/lib/cn'

interface MobileNavProps {
  userRole?: string
}

export function MobileNav({ userRole = 'STANDARD' }: MobileNavProps) {
  const pathname = usePathname() ?? ''
  const [isOpen, setIsOpen] = useState(false)

  const quickNav = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/invoices', icon: ReceiptText, label: 'Invoices' },
    { href: '/lists', icon: ShoppingCart, label: 'Lists' },
    { href: '/settings', icon: Settings, label: 'Settings' },
  ]

  const moreNav = [
    { href: '/review', icon: CheckSquare, label: 'Awaiting Check' },
    { href: '/reports', icon: LineChart, label: 'Price Trends' },
    { href: '/budgets', icon: Wallet, label: 'Category Budgets' },
    { href: '/household', icon: Users, label: 'Household Sync' },
  ]

  if (userRole === 'ADMIN') {
    moreNav.push({ href: '/admin', icon: Terminal, label: 'Admin Console' })
  }

  const handleLinkClick = () => {
    setIsOpen(false)
  }

  return (
    <>
      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--color-surface)] dark:bg-[var(--color-obsidian-glass)] border-t border-[var(--color-glass-border-light)] dark:border-[var(--color-glass-border)] backdrop-blur-[20px] flex justify-around py-2 lg:hidden shadow-lg pb-safe">
        {quickNav.map(({ href, icon: Icon, label }) => {
          const isActive = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-1 text-[11px] font-medium transition-colors px-3 py-1 rounded-md min-h-[44px] min-w-[44px] justify-center',
                isActive
                  ? 'text-electric-indigo font-bold'
                  : 'text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f1f5f9]'
              )}
            >
              <Icon size={20} className={isActive ? 'stroke-[2.5]' : 'stroke-[1.5]'} />
              <span>{label}</span>
            </Link>
          )
        })}

        {/* More Button */}
        <button
          onClick={() => setIsOpen(true)}
          className={cn(
            'flex flex-col items-center gap-1 text-[11px] font-medium transition-colors px-3 py-1 rounded-md min-h-[44px] min-w-[44px] justify-center',
            isOpen
              ? 'text-electric-indigo font-bold'
              : 'text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f1f5f9]'
          )}
          aria-expanded={isOpen}
          aria-label="More options"
        >
          <MoreHorizontal size={20} className="stroke-[1.5]" />
          <span>More</span>
        </button>
      </div>

      {/* Slide-over Mobile Drawer / Sheet */}
      <div
        className={cn(
          'fixed inset-0 z-50 transition-opacity lg:hidden',
          isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        )}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm dark:bg-black/60"
          onClick={() => setIsOpen(false)}
        />

        {/* Drawer Panel */}
        <div
          className={cn(
            'absolute bottom-0 left-0 right-0 max-h-[85vh] rounded-t-[20px] border-t border-[var(--color-glass-border-light)] dark:border-[var(--color-glass-border)] bg-[var(--color-surface)] dark:bg-[var(--color-obsidian-glass)] p-6 backdrop-blur-[30px] transition-transform duration-300 shadow-premium-glow flex flex-col',
            isOpen ? 'translate-y-0' : 'translate-y-full'
          )}
        >
          {/* Header & Swipe/Dismiss Handle */}
          <div className="flex flex-col items-center justify-between mb-4">
            <div className="h-1 w-12 rounded-full bg-slate-400/30 dark:bg-slate-500/30 mb-4" />
            <div className="flex w-full items-center justify-between">
              <span className="text-sm font-bold uppercase tracking-wider text-aurora-teal">
                More Features
              </span>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Navigation Links Grid */}
          <nav className="grid grid-cols-2 gap-4 py-4 overflow-y-auto">
            {moreNav.map(({ href, icon: Icon, label }) => {
              const isActive = pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={handleLinkClick}
                  className={cn(
                    'flex flex-col items-center justify-center p-4 rounded-xl border border-transparent transition-all duration-200 min-h-[44px] min-w-[44px]',
                    isActive
                      ? 'bg-electric-indigo/10 border-electric-indigo/20 text-electric-indigo font-bold'
                      : 'bg-slate-100/5 hover:bg-slate-100/10 text-slate-700 dark:text-slate-300'
                  )}
                >
                  <Icon size={24} className="mb-2 stroke-[1.5]" />
                  <span className="text-xs text-center">{label}</span>
                </Link>
              )
            })}
          </nav>
        </div>
      </div>
    </>
  )
}
