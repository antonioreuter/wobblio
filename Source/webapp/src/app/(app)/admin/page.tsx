'use client'

import { Terminal, ShieldAlert } from 'lucide-react'
import { StatCard } from '@/components/ui/stat-card'

export default function WebAppAdminPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[24px] font-bold text-[#0f172a] dark:text-[#f1f5f9] flex items-center gap-2">
          <Terminal className="text-rose-500" />
          Developer Console
        </h1>
        <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-1">
          System operational dashboard and waitlist bypass gates.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Waitlist Total" value="2,140" />
        <StatCard label="DLQ Size" value="0" />
        <StatCard label="Active Model" value="Gemini 1.5 Pro" />
        <StatCard label="AI Spend (MTD)" amount={24.85} />
      </div>

      <div className="glass-card p-6 flex flex-col gap-4 max-w-xl">
        <h2 className="text-sm font-bold uppercase tracking-wider text-rose-500 flex items-center gap-1.5">
          <ShieldAlert size={14} />
          SSM Config Parameters
        </h2>
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center text-xs border-b border-[var(--color-glass-border)] py-2">
            <span className="font-mono text-slate-400">/wobblio/production/waitlist-active</span>
            <span className="font-bold text-emerald-500">true</span>
          </div>
          <div className="flex justify-between items-center text-xs border-b border-[var(--color-glass-border)] py-2">
            <span className="font-mono text-slate-400">/wobblio/production/stripe-premium-price-id</span>
            <span className="font-mono text-slate-300">price_12345_prod</span>
          </div>
        </div>
      </div>
    </div>
  )
}
