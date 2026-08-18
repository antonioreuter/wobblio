'use client'

import { useState, type MouseEvent } from 'react'
import { formatViewMoney } from '@/lib/currency'

interface Series {
  id: string
  name: string
  color: string
  data: (number | null)[] // weekly median (null = no data that week → the line breaks)
  discounts: (number | null)[] // weekly discounted median, drawn as its own promo track
  stale: boolean // no observation in 60 days → greyed/dashed
  own?: boolean // the caller's own purchases — drawn dashed to distinguish from market lines
}

interface LineChartProps {
  series: Series[]
  months: string[]
  currency: string | null // ISO-4217 of the view; drives the axis symbol + tooltip amounts
}

type Point = [number, number] // [weekIndex, value]

// Splits a sparse series into contiguous drawable runs. The caller supplies a CONTINUOUS week axis,
// so a null really means "nobody observed a price that week" — runs are joined by a dotted connector
// rather than a solid line, which would assert a price path that was never seen.
function segments(data: (number | null)[]): Point[][] {
  const out: Point[][] = []
  let run: Point[] = []
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

const MAX_X_LABELS = 8

export function LineChart({ series, months, currency }: LineChartProps) {
  const [hover, setHover] = useState<number | null>(null)
  const money = (v: number) => formatViewMoney(v, currency)
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
  const labelStep = Math.max(1, Math.ceil(n / MAX_X_LABELS))

  const onMove = (e: MouseEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    let i = Math.round(((px - padL) / plotW) * (n - 1))
    i = Math.max(0, Math.min(n - 1, i))
    setHover(i)
  }

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img" aria-label={chartSummary(series, months, money)}>
        {gridVals.map((v, k) => (
          <g key={k}>
            <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} className="chart-grid" />
            <text x={padL - 8} y={y(v) + 4} className="chart-ylabel">{money(v)}</text>
          </g>
        ))}
        {months.map((m, i) =>
          (i % labelStep === 0 || i === n - 1) && (
            <text key={i} x={x(i)} y={H - 12} className="chart-xlabel">{m}</text>
          )
        )}
        {series.map((s) => (
          <Track
            key={`${s.id}-regular`}
            series={s}
            values={s.data}
            runDash={s.stale || s.own ? '5 4' : undefined}
            x={x}
            y={y}
            money={money}
          />
        ))}
        {/* §6.5.1 — promo prices are a distinct signal, never blended into the median. They get
            their own faint track so a series bought only on promo still visibly draws. */}
        {series.map((s) => (
          <Track key={`${s.id}-promo`} series={s} values={s.discounts} promo x={x} y={y} money={money} />
        ))}
        {/* A lone observation has no line to read, so label it outright. */}
        {series.map((s) => {
          const only = lonePoint(s)
          if (only === null) return null
          return (
            <text
              key={`${s.id}-lone`}
              className="chart-point-label"
              x={Math.min(x(only[0]) + 9, W - padR)}
              y={y(only[1]) + 4}
              textAnchor={only[0] === n - 1 && n > 1 ? 'end' : 'start'}
            >
              {money(only[1])}
            </text>
          )
        })}
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
                  {v !== null ? money(v) : '—'}
                  {d !== null && <span className="tip-promo"> · promo {money(d)}</span>}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// One drawable track: solid runs over consecutive weeks, dotted connectors across the weeks nobody
// observed, and a marker on every observed week so a single point is never invisible.
function Track({
  series,
  values,
  promo = false,
  runDash,
  x,
  y,
  money,
}: {
  series: Series
  values: (number | null)[]
  promo?: boolean
  runDash?: string
  x: (i: number) => number
  y: (v: number) => number
  money: (v: number) => string
}) {
  const runs = segments(values)
  if (runs.length === 0) return null
  const opacity = series.stale ? 0.5 : 1
  const label = promo ? 'Promo' : series.name

  return (
    <g opacity={opacity}>
      {runs.map((run, k) =>
        run.length < 2 ? null : (
          <polyline
            key={`run-${k}`}
            className={promo ? 'chart-promo-link' : undefined}
            fill="none"
            stroke={series.color}
            strokeWidth={promo ? 1.5 : 2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={runDash}
            points={run.map(([i, v]) => `${x(i)},${y(v)}`).join(' ')}
          />
        ),
      )}
      {runs.slice(1).map((run, k) => {
        const prev = runs[k][runs[k].length - 1]
        const next = run[0]
        return (
          <line
            key={`gap-${k}`}
            className="chart-gap"
            x1={x(prev[0])}
            y1={y(prev[1])}
            x2={x(next[0])}
            y2={y(next[1])}
            stroke={series.color}
          />
        )
      })}
      {runs.flat().map(([i, v]) =>
        promo ? (
          <path
            key={`pt-${i}`}
            className="chart-point"
            d={diamond(x(i), y(v), 4)}
            fill="var(--bg-color)"
            stroke={series.color}
            strokeWidth="1.75"
          >
            <title>Promo: {money(v)}</title>
          </path>
        ) : (
          <circle
            key={`pt-${i}`}
            className="chart-point"
            cx={x(i)}
            cy={y(v)}
            r="3.5"
            fill={series.color}
            stroke="var(--bg-color)"
            strokeWidth="1.5"
          >
            <title>{label}: {money(v)}</title>
          </circle>
        ),
      )}
    </g>
  )
}

// The single observed value of a series, when that is all it has across both tracks — the case that
// used to render as a 2.5px speck with no line and read as "the chart isn't drawing".
function lonePoint(series: Series): Point | null {
  const present: Point[] = []
  series.data.forEach((v, i) => {
    const value = v ?? series.discounts[i]
    if (value !== null && value !== undefined) present.push([i, value])
  })
  return present.length === 1 ? present[0] : null
}

// A short, factual description for screen readers; the data-table toggle carries the exact figures.
function chartSummary(series: Series[], months: string[], money: (v: number) => string): string {
  const values = series.flatMap((s) => s.data).filter((v): v is number => v !== null)
  if (values.length === 0 || months.length === 0) return 'Price paid per item. No prices to show.'
  const firstWeek = months[0]
  const lastWeek = months[months.length - 1]
  const count = series.length
  return `Price paid per item, ${count} series, ${money(values[0])} at ${firstWeek} to ${money(values[values.length - 1])} at ${lastWeek}. Toggle the data table for exact figures.`
}

function diamond(cx: number, cy: number, r: number): string {
  return `M ${cx} ${cy - r} L ${cx + r} ${cy} L ${cx} ${cy + r} L ${cx - r} ${cy} Z`
}
