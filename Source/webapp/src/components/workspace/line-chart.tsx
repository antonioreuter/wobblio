'use client'

import { useState, type MouseEvent } from 'react'

interface Series {
  id: string
  name: string
  color: string
  data: number[]
}

interface LineChartProps {
  series: Series[]
  months: string[]
}

export function LineChart({ series, months }: LineChartProps) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 760, H = 320, padL = 46, padR = 18, padT = 18, padB = 36
  const plotW = W - padL - padR
  const plotH = H - padT - padB
  const n = months.length
  const all = series.flatMap((s) => s.data)
  const lo = Math.min(...all)
  const hi = Math.max(...all)
  const yMin = Math.max(0, lo - (hi - lo) * 0.15 - 0.05)
  const yMax = hi + (hi - lo) * 0.15 + 0.05
  const x = (i: number) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW)
  const y = (v: number) => padT + (1 - (v - yMin) / (yMax - yMin || 1)) * plotH
  const ticks = 4
  const gridVals = Array.from({ length: ticks + 1 }, (_, k) => yMin + ((yMax - yMin) * k) / ticks)

  const onMove = (e: MouseEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    let i = Math.round(((px - padL) / plotW) * (n - 1))
    i = Math.max(0, Math.min(n - 1, i))
    setHover(i)
  }

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img" aria-label="Price timeline">
        {gridVals.map((v, k) => (
          <g key={k}>
            <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} className="chart-grid" />
            <text x={padL - 8} y={y(v) + 4} className="chart-ylabel">€{v.toFixed(2)}</text>
          </g>
        ))}
        {months.map((m, i) =>
          (i % 2 === 0 || i === n - 1) && (
            <text key={i} x={x(i)} y={H - 12} className="chart-xlabel">{m}</text>
          )
        )}
        {series.map((s) => (
          <polyline
            key={s.id}
            fill="none"
            stroke={s.color}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={s.data.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
          />
        ))}
        {hover !== null && (
          <line x1={x(hover)} y1={padT} x2={x(hover)} y2={padT + plotH} className="chart-cross" />
        )}
        {hover !== null && series.map((s) => (
          <circle
            key={s.id}
            cx={x(hover)}
            cy={y(s.data[hover])}
            r="4"
            fill="var(--bg-color)"
            stroke={s.color}
            strokeWidth="2.5"
          />
        ))}
        <rect
          x={padL}
          y={padT}
          width={plotW}
          height={plotH}
          fill="transparent"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        />
      </svg>
      {hover !== null && (
        <div className="chart-tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <div className="chart-tip-head">{months[hover]}</div>
          {series.map((s) => (
            <div className="chart-tip-row" key={s.id}>
              <span className="dot" style={{ background: s.color }} />
              <span className="nm">{s.name}</span>
              <span className="vl">€{s.data[hover].toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
