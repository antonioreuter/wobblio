import { cn } from '@/lib/cn'

type Confidence = 'confirmed' | 'auto' | 'low'

interface ConfidenceBadgeProps {
  confidence: Confidence
  className?: string
}

const config: Record<Confidence, { dot: string; label: string; bg: string; text: string }> = {
  confirmed: {
    dot: 'bg-[#16a34a]',
    label: 'Confirmed',
    bg: 'bg-[#dcfce7]',
    text: 'text-[#16a34a]',
  },
  auto: {
    dot: 'bg-[#0d9488]',
    label: 'Auto',
    bg: 'bg-[#ccfbf1]',
    text: 'text-[#0d9488]',
  },
  low: {
    dot: 'bg-[#d97706]',
    label: 'Low',
    bg: 'bg-[#fef3c7]',
    text: 'text-[#d97706]',
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
