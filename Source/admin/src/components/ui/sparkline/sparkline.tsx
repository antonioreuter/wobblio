interface SparklineProps {
  values: number[]
  width?: number
  height?: number
  className?: string
}

// Minimal dependency-free SVG sparkline. Flat line when all values are equal.
export function Sparkline({ values, width = 160, height = 36, className }: SparklineProps) {
  if (values.length === 0) {
    return <div className="text-xs text-[#94a3b8]">no data</div>
  }
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const stepX = values.length > 1 ? width / (values.length - 1) : 0
  const points = values
    .map((v, i) => `${(i * stepX).toFixed(1)},${(height - ((v - min) / span) * height).toFixed(1)}`)
    .join(' ')

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      role="img"
      aria-label="trend sparkline"
    >
      <polyline points={points} fill="none" stroke="#0d9488" strokeWidth={1.5} />
    </svg>
  )
}
