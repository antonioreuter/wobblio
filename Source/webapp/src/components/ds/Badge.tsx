import type { HTMLAttributes, ReactNode } from 'react'

export type BadgeTone = 'primary' | 'success' | 'warning' | 'danger'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children?: ReactNode
  tone?: BadgeTone
}

export function Badge({ children, tone = 'primary', className = '', ...rest }: BadgeProps) {
  return (
    <span className={`badge badge--${tone} ${className}`.trim()} {...rest}>
      {children}
    </span>
  )
}
