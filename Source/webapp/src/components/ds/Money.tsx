'use client'

import { useCountUp } from '@/hooks/use-count-up/use-count-up'

export interface MoneyProps {
  /** Amount in euros. */
  amount: number
  /** Count up from 0 on mount. */
  animate?: boolean
  className?: string
}

/**
 * Currency display where the cents are visually de-emphasised — a small
 * financial-grade typographic detail. Always tabular-nums.
 */
export function Money({ amount, animate = false, className }: MoneyProps) {
  const animated = useCountUp(animate ? amount : 0)
  const value = animate ? animated : amount
  const [euros, cents] = value.toFixed(2).split('.')

  return (
    <span className={`money ${className ?? ''}`.trim()}>
      €{euros}
      <span className="money-cents">.{cents}</span>
    </span>
  )
}
