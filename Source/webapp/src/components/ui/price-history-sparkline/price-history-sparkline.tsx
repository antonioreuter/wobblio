import { cn } from '@/lib/cn'

interface SparklinePoint {
  value: number
  stale?: boolean
}

interface PriceHistorySparklineProps {
  points: SparklinePoint[]
  width?: number
  height?: number
  className?: string
  stale?: boolean
}

function buildPath(points: number[], width: number, height: number): string {
  if (points.length < 2) return ''
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const stepX = width / (points.length - 1)
  const coords = points.map((v, i) => {
    const x = i * stepX
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  })
  return `M ${coords.join(' L ')}`
}

export function PriceHistorySparkline({
  points,
  width = 80,
  height = 24,
  className,
  stale = false,
}: PriceHistorySparklineProps) {
  const values = points.map((p) => p.value)
  const path = buildPath(values, width, height)

  if (points.length < 2) return null

  return (
    <div className={cn('relative inline-flex flex-col', className)} title={stale ? 'Stale data' : undefined}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={cn(stale && 'opacity-40')}
        aria-hidden
      >
        <path
          d={path}
          fill="none"
          stroke="#0d9488"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {stale && (
        <span className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-[#d97706]" title="Stale" />
      )}
    </div>
  )
}
