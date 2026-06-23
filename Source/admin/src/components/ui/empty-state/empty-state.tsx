import type { LucideIcon } from 'lucide-react'
import { Icon } from '@/components/ui/icon'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

interface EmptyStateProps {
  icon: LucideIcon
  heading: string
  body: string
  ctaLabel?: string
  onCta?: () => void
  className?: string
}

export function EmptyState({ icon, heading, body, ctaLabel, onCta, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-12 text-center',
        className
      )}
      data-testid="empty-state"
    >
      <Icon icon={icon} size={32} className="text-muted " />
      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold text-fg ">{heading}</p>
        <p className="max-w-xs text-sm text-muted ">{body}</p>
      </div>
      {ctaLabel && onCta && (
        <Button variant="primary" size="md" onClick={onCta}>
          {ctaLabel}
        </Button>
      )}
    </div>
  )
}
