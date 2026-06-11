import { cn } from '@/lib/cn'

interface CategoryChipProps {
  label: string
  color: string
  className?: string
  size?: 'sm' | 'md'
}

export function CategoryChip({ label, color, className, size = 'md' }: CategoryChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-[#e2e8f0] bg-white font-medium dark:border-[#334155] dark:bg-[#1e293b]',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
        className
      )}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span className="text-[#0f172a] dark:text-[#f1f5f9]">{label}</span>
    </span>
  )
}
