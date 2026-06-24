import { formatMoney, formatDelta } from '@/lib/currency'
import { cn } from '@/lib/cn'

interface MoneyProps {
  amount: number
  currency?: string
  locale?: string
  className?: string
  size?: 'display' | 'body' | 'secondary'
}

const sizeClasses = {
  display: 'text-[30px] font-bold leading-[36px]',
  body: 'text-base font-medium',
  secondary: 'text-sm font-normal',
}

export function Money({
  amount,
  currency = 'EUR',
  locale = 'nl-NL',
  className,
  size = 'body',
}: MoneyProps) {
  return (
    <span
      className={cn('tabular font-[Inter]', sizeClasses[size], className)}
      style={{ fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum"' }}
    >
      {formatMoney(amount, { currency, locale })}
    </span>
  )
}

interface DeltaChipProps {
  value: number
  suffix?: string
  className?: string
}

export function DeltaChip({ value, suffix = '%', className }: DeltaChipProps) {
  const isPositive = value > 0
  const isNeutral = value === 0

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        isNeutral && 'bg-elevated text-muted  ',
        isPositive && 'bg-danger-soft text-danger',
        !isPositive && !isNeutral && 'bg-success-soft text-success',
        className
      )}
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {formatDelta(value, suffix)}
    </span>
  )
}
