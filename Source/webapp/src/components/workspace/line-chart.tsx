'use client'

import { useState, type MouseEvent } from 'react'

interface Series {
  id: string
  name: string
  color: string
  data: (number | null)[] // weekly median (null = no data that week → line breaks)
  discounts: (number | null)[] // weekly discounted median, drawn as distinct markers
  stale: boolean // no observation in 60 days → greyed/dashed
  own?: boolean // the caller's own purchases — drawn dashed to distinguish from market lines
}

interface LineChartProps {
  series: Series[]
  months: string[]
}

// Splits a sparse series into contiguous drawable runs so missing weeks leave a gap
// rather than interpolating a price that was never observed.
function segments(data: (number | null)[]): Array<Array<[number, number]>> {
  const out: Array<Array<[number, number]>> = []
  let run: Array<[number, number]> = []
  data.forEach((v, i) => {
    if (v === null) {
      if (run.length) out.push(run)
      run = []
      return
    }
    run.push([i, v])
  })
  if (run.length) out.push(run)
  return out
}

export function LineChart({ series, months }: LineChartProps) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 760, H = 320, padL = 46, padR = 18, padT = 18, padB = 36
  const plotW = W - padL - padR
  const plotH = H - padT - padB
  const n = months.length
  const all = series.flatMap((s) => [...s.data, ...s.discounts]).filter((v): v is number => v !== null)
  const lo = all.length ? Math.min(...all) : 0
  const hi = all.length ? Math.max(...all) : 1
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
        {series.map((s) =>
          segments(s.data).map((seg, k) =>
            seg.length === 1 ? (
              <circle key={`${s.id}-pt-${k}`} cx={x(seg[0][0])} cy={y(seg[0][1])} r="2.5" fill={s.color} opacity={s.stale ? 0.5 : 1} />
            ) : (
              <polyline
                key={`${s.id}-seg-${k}`}
                fill="none"
                stroke={s.color}
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={s.stale || s.own ? '5 4' : undefined}
                opacity={s.stale ? 0.5 : 1}
                points={seg.map(([i, v]) => `${x(i)},${y(v)}`).join(' ')}
              />
            ),
          ),
        )}
        {/* §6.5.1 discount markers — promo prices as a distinct signal, not blended */}
        {series.map((s) =>
          s.discounts.map((v, i) =>
            v === null ? null : (
              <path
                key={`${s.id}-disc-${i}`}
                d={diamond(x(i), y(v), 4)}
                fill="var(--bg-color)"
                stroke={s.color}
                strokeWidth="1.75"
                opacity={s.stale ? 0.5 : 1}
              >
                <title>Promo: €{v.toFixed(2)}</title>
              </path>
            ),
          ),
        )}
        {hover !== null && (
          <line x1={x(hover)} y1={padT} x2={x(hover)} y2={padT + plotH} className="chart-cross" />
        )}
        {hover !== null && series.map((s) =>
          s.data[hover] === null ? null : (
            <circle
              key={s.id}
              cx={x(hover)}
              cy={y(s.data[hover] as number)}
              r="4"
              fill="var(--bg-color)"
              stroke={s.color}
              strokeWidth="2.5"
            />
          ),
        )}
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
          {series.map((s) => {
            const v = s.data[hover]
            const d = s.discounts[hover]
            if (v === null && d === null) return null
            return (
              <div className="chart-tip-row" key={s.id}>
                <span className="dot" style={{ background: s.color }} />
                <span className="nm">{s.name}</span>
                <span className="vl">
                  {v !== null ? `€${v.toFixed(2)}` : '—'}
                  {d !== null && <span className="tip-promo"> · promo €{d.toFixed(2)}</span>}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function diamond(cx: number, cy: number, r: number): string {
  return `M ${cx} ${cy - r} L ${cx + r} ${cy} L ${cx} ${cy + r} L ${cx - r} ${cy} Z`
}
