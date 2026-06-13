import { cn } from '@/lib/cn'

type Confidence = 'confirmed' | 'auto' | 'low'

interface ConfidenceBadgeProps {
  confidence: Confidence
  className?: string
}

const config: Record<Confidence, { dot: string; label: string; bg: string; text: string }> = {
  confirmed: {
    dot: 'bg-emerald-600 dark:bg-emerald-500',
    label: 'Confirmed',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-500/20',
    text: '',
  },
  auto: {
    dot: 'bg-teal-600 dark:bg-teal-500',
    label: 'Auto',
    bg: 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-200/60 dark:border-teal-500/20',
    text: '',
  },
  low: {
    dot: 'bg-amber-600 dark:bg-amber-500',
    label: 'Low',
    bg: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-500/20',
    text: '',
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
