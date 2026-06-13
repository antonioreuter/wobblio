'use client'

import { Wallet, Plus, ShoppingCart, UtensilsCrossed, Car, Flame, Sparkles, TrendingUp, AlertTriangle } from 'lucide-react'
import { Money } from '@/components/ui/money'

export default function BudgetsPage() {
  const budgets = [
    {
      label: 'Groceries',
      spent: 340,
      limit: 500,
      icon: ShoppingCart,
      color: 'var(--color-aurora-teal)',
      status: 'On Track',
      statusColor: 'text-teal-500 bg-teal-500/10'
    },
    {
      label: 'Dining',
      spent: 261,
      limit: 300,
      icon: UtensilsCrossed,
      color: 'var(--color-warm-amber)',
      status: 'Near Limit',
      statusColor: 'text-amber-500 bg-amber-500/10'
    },
    {
      label: 'Transport',
      spent: 78,
      limit: 150,
      icon: Car,
      color: 'var(--brand)',
      status: 'On Track',
      statusColor: 'text-indigo-500 bg-indigo-500/10'
    },
    {
      label: 'Shopping & Others',
      spent: 320,
      limit: 300,
      icon: Flame,
      color: 'var(--color-sunset-coral)',
      status: 'Over Budget',
      statusColor: 'text-rose-500 bg-rose-500/10'
    }
  ]

  const totalSpent = budgets.reduce((acc, b) => acc + b.spent, 0)
  const totalLimit = budgets.reduce((acc, b) => acc + b.limit, 0)
  const totalPct = Math.round((totalSpent / totalLimit) * 100)

  // circular math: radius 70, circumference = 2 * PI * 70 = 439.8
  const strokeDashoffset = 439.8 * (1 - totalSpent / totalLimit)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-[24px] font-bold text-[#0f172a] dark:text-[#f1f5f9]">Category Budgets</h1>
          <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-1">
            Set and monitor category limits to manage household expenditures.
          </p>
        </div>
        <button
          className="inline-flex h-10 items-center justify-center rounded-lg bg-aurora-teal px-4 text-xs font-semibold text-white hover:bg-[#0f766e] min-h-[44px]"
          onClick={() => alert('New budget item configuration coming soon!')}
        >
          <Plus size={14} className="mr-1.5" />
          Create Budget
        </button>
      </div>

      <div className="budgets-grid">
        {/* Left Column: Active Budgets Grid */}
        <div className="flex flex-col gap-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Wallet size={14} className="text-aurora-teal" />
            Active Budgets
          </h2>

          <div className="budgets-card-grid">
            {budgets.map((b, idx) => {
              const Icon = b.icon
              const pct = Math.round((b.spent / b.limit) * 100)
              return (
                <div key={idx} className="glass-card budget-card-item">
                  <div className="flex justify-between items-start">
                    <div className="p-2.5 rounded-lg bg-slate-100/5 border border-[var(--color-glass-border)] text-[var(--text-primary)]">
                      <Icon size={18} style={{ color: b.color }} />
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${b.statusColor}`}>
                      {b.status}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">{b.label}</h3>
                    <div className="flex justify-between items-baseline mt-2 font-mono">
                      <span className="text-lg font-bold text-[var(--text-primary)]">
                        <Money amount={b.spent} size="secondary" />
                      </span>
                      <span className="text-xs text-slate-400">
                        of <Money amount={b.limit} size="secondary" />
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(pct, 100)}%`,
                          backgroundColor: b.color,
                          boxShadow: `0 0 10px ${b.color}40`
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1.5 block font-semibold">{pct}% used</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Column: Visual Summary & Insights */}
        <div className="glass-card p-6 flex flex-col items-center gap-6 sticky top-6">
          <h3 className="text-sm font-bold text-[var(--text-primary)] self-start border-b border-[var(--color-glass-border)] w-full pb-3">
            Spending Summary
          </h3>

          <div className="relative flex items-center justify-center h-48 w-48">
            <svg width="180" height="180" viewBox="0 0 180 180" className="progress-ring-svg">
              <circle
                cx="90"
                cy="90"
                r="70"
                stroke="var(--color-glass-border-light)"
                className="dark:stroke-[rgba(255,255,255,0.05)]"
                strokeWidth="10"
                fill="transparent"
              />
              <circle
                cx="90"
                cy="90"
                r="70"
                stroke="url(#auroraTealGradient)"
                strokeWidth="10"
                fill="transparent"
                strokeDasharray="439.8"
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="progress-ring-circle"
              />
              <defs>
                <linearGradient id="auroraTealGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--brand)" />
                  <stop offset="100%" stopColor="var(--success)" />
                </linearGradient>
              </defs>
            </svg>

            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-extrabold text-[var(--text-primary)] font-display">{totalPct}%</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Budget Used</span>
            </div>
          </div>

          <div className="w-full text-center">
            <p className="text-xs text-slate-400">Total Spent this month</p>
            <div className="text-2xl font-extrabold text-[var(--text-primary)] font-mono mt-1">
              <Money amount={totalSpent} size="secondary" />
              <span className="text-sm font-normal text-slate-400 font-sans ml-1">
                of <Money amount={totalLimit} size="secondary" />
              </span>
            </div>
          </div>

          {/* Savings Insights list */}
          <div className="w-full border-t border-[var(--color-glass-border)] pt-5 flex flex-col gap-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={13} className="text-indigo-400" />
              Saving Insights
            </h4>
            <div className="flex flex-col gap-3">
              <div className="flex gap-2.5 items-start text-xs">
                <TrendingUp size={14} className="text-teal-500 shrink-0 mt-0.5" />
                <p className="text-slate-500 dark:text-slate-400 leading-normal">
                  Groceries is on track, saving you <strong>€15.40</strong> compared to last month’s run rate.
                </p>
              </div>
              <div className="flex gap-2.5 items-start text-xs">
                <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-slate-500 dark:text-slate-400 leading-normal">
                  Dining is at 87% limit. Consider optimizing list items for cooking at home.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

