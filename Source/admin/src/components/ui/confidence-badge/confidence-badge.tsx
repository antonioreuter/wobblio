import { cn } from '@/lib/cn'

type Confidence = 'confirmed' | 'auto' | 'low'

interface ConfidenceBadgeProps {
  confidence: Confidence
  className?: string
}

const config: Record<Confidence, { dot: string; label: string; bg: string; text: string }> = {
  confirmed: {
    dot: 'bg-success',
    label: 'Confirmed',
    bg: 'bg-success-soft',
    text: 'text-success',
  },
  auto: {
    dot: 'bg-brand',
    label: 'Auto',
    bg: 'bg-brand-soft',
    text: 'text-brand',
  },
  low: {
    dot: 'bg-warning',
    label: 'Low',
    bg: 'bg-warning-soft',
    text: 'text-warning',
  },
}

export function ConfidenceBadge({ confidence, className }: ConfidenceBadgeProps) {
  const { dot, label, bg, text } = config[confidence]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
        bg,
        text,
        className
      )}
      data-testid={`confidence-badge-${confidence}`}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dot)} aria-hidden />
      {label}
    </span>
  )
}
