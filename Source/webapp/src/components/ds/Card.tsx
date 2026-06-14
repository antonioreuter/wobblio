import type { HTMLAttributes, ReactNode } from 'react'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode
  interactive?: boolean
}

export function Card({ children, interactive = false, className = '', style, ...rest }: CardProps) {
  const classes = ['glass', interactive ? 'glass-interactive' : '', className]
    .filter(Boolean)
    .join(' ')
  return (
    <div className={classes} style={{ padding: 'var(--space-6)', ...style }} {...rest}>
      {children}
    </div>
  )
}
