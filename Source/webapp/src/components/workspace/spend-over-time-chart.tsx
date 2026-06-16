'use client'

import { useState, type MouseEvent } from 'react'
import { Table2 } from 'lucide-react'
import { Card } from '@/components/ds'
import { SPEND_OVER_TIME } from './invoice-data'

const eur = (v: number) => `€${v.toFixed(2)}`

interface SpendOverTimeChartProps {
  data?: Array<{ month: string; total: number }>
}

export function SpendOverTimeChart({ data: dataProp }: SpendOverTimeChartProps = {}) {
  const [hover, setHover] = useState<number | null>(null)
  const [showTable, setShowTable] = useState(false)
  const data = dataProp ?? SPEND_OVER_TIME

  const W = 760, H = 300, padL = 52, padR = 18, padT = 20, padB = 34
  const plotW = W - padL - padR
  const plotH = H - padT - padB
  const n = data.length
  const totals = data.map((d) => d.total)
  const lo = Math.min(...totals)
  const hi = Math.max(...totals)
  const yMin = Math.max(0, lo - (hi - lo) * 0.4)
  const yMax = hi + (hi - lo) * 0.2
  const x = (i: number) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW)
  const y = (v: number) => padT + (1 - (v - yMin) / (yMax - yMin || 1)) * plotH

  const ticks = 4
  const gridVals = Array.from({ length: ticks + 1 }, (_, k) => yMin + ((yMax - yMin) * k) / ticks)
  const linePts = data.map((d, i) => `${x(i)},${y(d.total)}`).join(' ')
  const areaPts = `${padL},${y(yMin)} ${linePts} ${x(n - 1)},${y(yMin)}`
  const mtdIndex = n - 1
  const total6mo = totals.reduce((a, b) => a + b, 0)

  const onMove = (e: MouseEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    let i = Math.round(((px - padL) / plotW) * (n - 1))
    i = Math.max(0, Math.min(n - 1, i))
    setHover(i)
  }

  return (
    <Card className="panel">
      <div className="panel-header" style={{ marginBottom: 4 }}>
        <span className="panel-title">Spend over time</span>
        <div className="panel-actions">
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Last 6 months</span>
          <button
            type="button"
            className="btn-icon has-tip has-tip--bottom"
            data-tip={showTable ? 'Show chart' : 'Show data table'}
            aria-label={showTable ? 'Show chart' : 'Show data table'}
            aria-pressed={showTable}
            onClick={() => setShowTable((v) => !v)}
            data-testid="spend-chart-table-toggle"
          >
            <Table2 size={15} />
          </button>
        </div>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 16 }}>
        <strong style={{ color: 'var(--text-primary)' }}>{eur(total6mo)}</strong>{' '}
        across the last 6 months · {data[mtdIndex].month} is month-to-date.
      </p>

      {showTable ? (
        <table className="app-table chart-data-table" data-testid="spend-chart-table">
          <thead>
            <tr>
              <th>Month</th>
              <th className="num">Total spend</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={d.month}>
                <td>{d.month}{i === mtdIndex ? ' (MTD)' : ''}</td>
                <td className="num">{eur(d.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="chart-wrap">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="chart-svg"
            role="img"
            aria-label={`Total spend over the last 6 months, from ${eur(data[0].total)} in ${data[0].month} to ${eur(data[mtdIndex].total)} month-to-date in ${data[mtdIndex].month}. Toggle the data table for exact figures.`}
          >
            <defs>
              <linearGradient id="spendArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.32" />
                <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {gridVals.map((v, k) => (
              <g key={k}>
                <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} className="chart-grid" />
                <text x={padL - 8} y={y(v) + 4} className="chart-ylabel">€{Math.round(v)}</text>
              </g>
            ))}
            {data.map((d, i) => (
              <text key={d.month} x={x(i)} y={H - 12} className="chart-xlabel">{d.month}</text>
            ))}
            <polygon className="spend-area" points={areaPts} fill="url(#spendArea)" />
            <polyline
              className="spend-line"
              fill="none"
              stroke="var(--brand)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              pathLength={1}
              points={linePts}
            />
            {hover !== null && (
              <line x1={x(hover)} y1={padT} x2={x(hover)} y2={padT + plotH} className="chart-cross" />
            )}
            {/* MTD emphasis dot with a soft pulsing halo */}
            <circle className="mtd-halo" cx={x(mtdIndex)} cy={y(data[mtdIndex].total)} r="4.5" fill="var(--brand)" />
            <circle cx={x(mtdIndex)} cy={y(data[mtdIndex].total)} r="4.5" fill="var(--brand)" />
            {hover !== null && hover !== mtdIndex && (
              <circle
                cx={x(hover)}
                cy={y(data[hover].total)}
                r="4"
                fill="var(--bg-color)"
                stroke="var(--brand)"
                strokeWidth="2.5"
              />
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
              <div className="chart-tip-head">
                {data[hover].month}{hover === mtdIndex ? ' · MTD' : ''}
              </div>
              <div className="chart-tip-row">
                <span className="dot" style={{ background: 'var(--brand)' }} />
                <span className="nm">Total spend</span>
                <span className="vl">{eur(data[hover].total)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
