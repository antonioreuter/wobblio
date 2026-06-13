'use client'

import { Shield, RotateCcw } from 'lucide-react'
import { useSandbox } from '@/components/providers/sandbox-provider'
import { cn } from '@/lib/cn'

export function SandboxControls() {
  const { isRlsEnforced, toggleRls, reloadSeedData } = useSandbox()

  return (
    <div className="flex items-center gap-2">
      {/* RLS Toggle Button */}
      <button
        onClick={toggleRls}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-colors min-h-[44px] sm:min-h-0',
          isRlsEnforced
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
            : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 shadow-premium-glow'
        )}
        aria-label={isRlsEnforced ? 'RLS: Enforced' : 'RLS: Bypassed'}
      >
        <Shield
          size={14}
          className={cn(
            'stroke-[2]',
            isRlsEnforced ? 'text-emerald-500' : 'text-rose-500'
          )}
        />
        <span className="hidden sm:inline">
          {isRlsEnforced ? 'RLS: Enforced' : 'RLS: Bypassed'}
        </span>
      </button>

      {/* Reload Seed Data Button */}
      <button
        onClick={reloadSeedData}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-white px-2.5 py-1.5 text-xs font-medium text-[#0f172a] hover:bg-[#f8fafc] dark:border-[#334155] dark:bg-[#111827] dark:text-[#f1f5f9] min-h-[44px] sm:min-h-0"
        title="Reload initial seed data"
        aria-label="Reload seed data"
      >
        <RotateCcw size={14} className="stroke-[1.5]" />
        <span className="hidden sm:inline">Reload Seed</span>
      </button>
    </div>
  )
}
