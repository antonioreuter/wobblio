import { cn } from '@/lib/cn'
import { Money } from '@/components/ui/money'

interface BudgetProgressBarProps {
  label: string
  spent: number
  limit: number
  currency?: string
  className?: string
}

function getBarColor(pct: number): string {
  if (pct >= 1) return 'bg-[#dc2626]'
  if (pct >= 0.85) return 'bg-[#d97706]'
  return 'bg-[#0d9488]'
}

export function BudgetProgressBar({
  label,
  spent,
  limit,
  currency = 'EUR',
  className,
}: BudgetProgressBarProps) {
  const pct = Math.min(spent / limit, 1)
  const pctDisplay = Math.round(pct * 100)
  const barColor = getBarColor(pct)
  const isWarning = pct >= 0.85

  return (
    <div className={cn('flex flex-col gap-1.5', className)} data-testid="budget-progress-bar">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-[#0f172a] dark:text-[#f1f5f9]">{label}</span>
          {isWarning && (
            <span
              className="text-xs text-[#d97706]"
              aria-label="Budget warning"
              title="Over 85% of budget used"
            >
              !
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-[#64748b] dark:text-[#94a3b8]">
          <Money amount={spent} currency={currency} size="secondary" />
          <span>/</span>
          <Money amount={limit} currency={currency} size="secondary" />
        </div>
      </div>

      <div
        className="relative h-2 w-full overflow-visible rounded-full bg-[#e2e8f0] dark:bg-[#334155]"
        role="progressbar"
        aria-valuenow={pctDisplay}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${pctDisplay}% of budget used`}
      >
        <div
          className={cn('h-full rounded-full transition-all', barColor)}
          style={{ width: `${Math.min(pct * 100, 100)}%` }}
        />
        {/* 85% tick mark */}
        <div
          className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-[#64748b]/40 dark:bg-[#94a3b8]/40"
          style={{ left: '85%' }}
          aria-hidden
        />
      </div>
    </div>
  )
}
