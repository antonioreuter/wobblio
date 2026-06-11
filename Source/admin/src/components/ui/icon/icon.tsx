import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

interface IconProps {
  icon: LucideIcon
  size?: number
  className?: string
  'aria-hidden'?: boolean
  'aria-label'?: string
}

export function Icon({
  icon: LucideIconComponent,
  size = 20,
  className,
  'aria-hidden': ariaHidden = true,
  'aria-label': ariaLabel,
}: IconProps) {
  return (
    <LucideIconComponent
      size={size}
      strokeWidth={1.5}
      className={cn('shrink-0', className)}
      aria-hidden={ariaHidden}
      aria-label={ariaLabel}
    />
  )
}
