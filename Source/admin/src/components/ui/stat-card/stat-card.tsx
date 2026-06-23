import { Card } from '@/components/ui/card'
import { Money, DeltaChip } from '@/components/ui/money'
import { cn } from '@/lib/cn'

interface StatCardProps {
  label: string
  amount?: number
  value?: string
  currency?: string
  delta?: number
  deltaLabel?: string
  className?: string
}

export function StatCard({
  label,
  amount,
  value,
  currency = 'EUR',
  delta,
  deltaLabel,
  className,
}: StatCardProps) {
  return (
    <Card className={cn('min-w-[160px] flex-1', className)}>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted ">
        {label}
      </p>
      {amount !== undefined ? (
        <Money
          amount={amount}
          currency={currency}
          size="display"
          className="block text-fg "
        />
      ) : (
        <p
          className="text-[30px] font-bold leading-[36px] text-fg "
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {value}
        </p>
      )}
      {delta !== undefined && (
        <div className="mt-2 flex items-center gap-1.5">
          <DeltaChip value={delta} />
          {deltaLabel && (
            <span className="text-xs text-muted ">{deltaLabel}</span>
          )}
        </div>
      )}
    </Card>
  )
}
