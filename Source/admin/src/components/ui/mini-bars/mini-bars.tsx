import { cn } from '@/lib/cn'

interface MiniBarsProps {
  values: number[]
  height?: number
  className?: string
}

// Dependency-free vertical bar chart for a short count series (themed green).
export function MiniBars({ values, height = 44, className }: MiniBarsProps) {
  if (values.length === 0) {
    return <div className="text-xs text-faint">no data</div>
  }
  const max = Math.max(1, ...values)
  return (
    <div className={cn('flex items-end gap-0.5', className)} style={{ height }} role="img" aria-label="bar chart">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm bg-brand"
          style={{ height: `${(v / max) * 100}%`, minHeight: v > 0 ? 2 : 0 }}
          title={String(v)}
        />
      ))}
    </div>
  )
}
