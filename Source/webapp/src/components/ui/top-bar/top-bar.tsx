'use client'

import { Search, Sun, Moon, User } from 'lucide-react'
import { useTheme } from '@/components/providers/theme-provider'
import { cn } from '@/lib/cn'

interface TopBarProps {
  quotaUsed?: number
  quotaLimit?: number
  className?: string
}

export function TopBar({ quotaUsed = 0, quotaLimit = 10, className }: TopBarProps) {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <header
      className={cn(
        'flex h-14 shrink-0 items-center gap-4 border-b border-[#e2e8f0] bg-white px-4 dark:border-[#334155] dark:bg-[#111827]',
        className
      )}
    >
      {/* Global search */}
      <div className="relative flex-1 max-w-md">
        <Search
          size={14}
          strokeWidth={1.5}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]"
          aria-hidden
        />
        <input
          type="search"
          placeholder="Search invoices, merchants, products…"
          className="h-8 w-full rounded-full border border-[#e2e8f0] bg-[#f8fafc] pl-8 pr-3 text-sm text-[#0f172a] placeholder:text-[#64748b] focus:border-[#0d9488] focus:outline-none focus:ring-1 focus:ring-[#0d9488]/30 dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#f1f5f9] dark:placeholder:text-[#94a3b8]"
          aria-label="Search invoices, merchants, products"
        />
      </div>

      <div className="ml-auto flex items-center gap-3">
        {/* Quota chip */}
        <span className="inline-flex items-center rounded-full border border-[#0d9488]/30 bg-[#ccfbf1] px-2.5 py-1 text-xs font-medium text-[#0d9488]">
          {quotaUsed}/{quotaLimit} scans
        </span>

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          className="rounded-full p-1.5 text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a] dark:text-[#94a3b8] dark:hover:bg-[#1e293b] dark:hover:text-[#f1f5f9]"
          aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {resolvedTheme === 'dark' ? (
            <Sun size={16} strokeWidth={1.5} aria-hidden />
          ) : (
            <Moon size={16} strokeWidth={1.5} aria-hidden />
          )}
        </button>

        {/* Avatar */}
        <button
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0d9488] text-white"
          aria-label="Open user menu"
          aria-haspopup="menu"
        >
          <User size={14} strokeWidth={1.5} aria-hidden />
        </button>
      </div>
    </header>
  )
}
