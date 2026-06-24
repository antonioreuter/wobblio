import type { ReactNode } from 'react'

export interface ChartSeries {
  label: string
  color: string
  values: number[]
}

interface ChartProps {
  series: ChartSeries[]
  xLabels: string[]
  type?: 'bar' | 'line' | 'area' // bar/area with multiple series = stacked
  height?: number
  formatY?: (n: number) => string
  testid?: string
}

const VB_W = 640
const GRID_LINES = 4

// Dependency-free SVG chart with y-axis scale + horizontal gridlines, x-axis date
// labels, and a legend. Bars stack when there are multiple series; lines overlay.
// Text is rendered as crisp HTML outside the (non-uniformly scaled) SVG.
export function Chart({ series, xLabels, type = 'bar', height = 140, formatY, testid }: ChartProps) {
  const n = xLabels.length
  if (n === 0 || series.length === 0) {
    return <div className="py-8 text-center text-xs text-faint">no data</div>
  }
  const fmt = formatY ?? ((v: number) => v.toLocaleString())
  const max = chartMax(series, type, n)
  const ticks = Array.from({ length: GRID_LINES + 1 }, (_, i) => (max * (GRID_LINES - i)) / GRID_LINES)

  return (
    <div data-testid={testid}>
      <div className="mb-2 flex flex-wrap gap-3">
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5 text-xs text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <div
          className="flex shrink-0 flex-col justify-between text-right text-[10px] text-faint tabular-nums"
          style={{ height }}
        >
          {ticks.map((t, i) => (
            <span key={i}>{fmt(Math.round(t))}</span>
          ))}
        </div>
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${VB_W} ${height}`}
          preserveAspectRatio="none"
          className="flex-1"
          role="img"
          aria-label="chart"
        >
          {ticks.map((_, i) => {
            const y = (height * i) / GRID_LINES
            return <line key={i} x1={0} y1={y} x2={VB_W} y2={y} stroke="var(--color-line)" strokeWidth={1} />
          })}
          {renderPlot(type, series, n, max, height)}
        </svg>
      </div>
      <div className="ml-10 mt-1 flex justify-between text-[10px] text-faint">
        <span>{xLabels[0]}</span>
        {n > 2 && <span>{xLabels[Math.floor(n / 2)]}</span>}
        {n > 1 && <span>{xLabels[n - 1]}</span>}
      </div>
    </div>
  )
}

function renderPlot(type: 'bar' | 'line' | 'area', series: ChartSeries[], n: number, max: number, height: number) {
  if (type === 'line') return renderLines(series, n, max, height)
  // Area needs ≥2 points to draw a band; fall back to bars for a single point.
  if (type === 'area' && n >= 2) return renderArea(series, n, max, height)
  return renderBars(series, n, max, height)
}

function chartMax(series: ChartSeries[], type: 'bar' | 'line' | 'area', n: number): number {
  let max = 1
  if (type === 'bar' || type === 'area') {
    for (let i = 0; i < n; i++) {
      const stacked = series.reduce((acc, s) => acc + (s.values[i] ?? 0), 0)
      if (stacked > max) max = stacked
    }
  } else {
    for (const s of series) for (const v of s.values) if (v > max) max = v
  }
  return max
}

function renderBars(series: ChartSeries[], n: number, max: number, height: number) {
  const slot = VB_W / n
  const barW = slot * 0.7
  const pad = (slot - barW) / 2
  const bars: ReactNode[] = []
  for (let i = 0; i < n; i++) {
    let yBottom = height
    for (const s of series) {
      const v = s.values[i] ?? 0
      const h = (v / max) * height
      if (h > 0) {
        bars.push(
          <rect key={`${s.label}-${i}`} x={i * slot + pad} y={yBottom - h} width={barW} height={h} fill={s.color} />,
        )
        yBottom -= h
      }
    }
  }
  return bars
}

function renderArea(series: ChartSeries[], n: number, max: number, height: number) {
  const step = VB_W / (n - 1)
  const cum = new Array(n).fill(0)
  const y = (v: number) => (height - (v / max) * height).toFixed(1)
  return series.map((s) => {
    const top = s.values.map((v, i) => cum[i] + (v ?? 0))
    const topPts = top.map((t, i) => `${(i * step).toFixed(1)},${y(t)}`)
    const botPts = cum.map((c, i) => `${(i * step).toFixed(1)},${y(c)}`).reverse()
    for (let i = 0; i < n; i++) cum[i] = top[i]
    return (
      <polygon
        key={s.label}
        points={[...topPts, ...botPts].join(' ')}
        fill={s.color}
        fillOpacity={0.55}
        stroke={s.color}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    )
  })
}

function renderLines(series: ChartSeries[], n: number, max: number, height: number) {
  const step = n > 1 ? VB_W / (n - 1) : 0
  return series.map((s) => {
    const pts = s.values
      .map((v, i) => `${(i * step).toFixed(1)},${(height - (v / max) * height).toFixed(1)}`)
      .join(' ')
    return <polyline key={s.label} points={pts} fill="none" stroke={s.color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
  })
}
