'use client'

import { useCountUp } from '@/hooks/use-count-up/use-count-up'

export interface AnimatedNumberProps {
  value: number
  decimals?: number
  prefix?: string
  suffix?: string
  className?: string
}

export function AnimatedNumber({ value, decimals = 0, prefix, suffix, className }: AnimatedNumberProps) {
  const current = useCountUp(value)
  return (
    <span className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {prefix}
      {current.toFixed(decimals)}
      {suffix}
    </span>
  )
}
