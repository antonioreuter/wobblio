'use client'

import { useState, useMemo, type MouseEvent } from 'react'
import { Table2, Calendar, BarChart3, X } from 'lucide-react'
import { Card } from '@/components/ds'
import { SPEND_OVER_TIME } from './invoice-data'

const eur = (v: number) => `€${v.toFixed(2)}`

const W = 760
const H = 300
const padL = 52
const padR = 18
const padT = 20
const padB = 34
const plotW = W - padL - padR
const plotH = H - padT - padB

const getX = (i: number, n: number) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW)

interface SpendOverTimeChartProps {
  data?: Array<{ month: string; total: number }>
  dailyData?: Array<{ day: string; total: number; isWeekend?: boolean; weekday?: string; dateLabel?: string }>
}

export function SpendOverTimeChart({ data: dataProp, dailyData }: SpendOverTimeChartProps = {}) {
  const [hover, setHover] = useState<number | null>(null)
  const [showTable, setShowTable] = useState(false)
  const [mode, setMode] = useState<'month' | 'quarter'>('month')
  
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const monthlyData = dataProp ?? SPEND_OVER_TIME
  // Quarter view shows the trailing 3 months; month view shows the daily series.
  const data = mode === 'month' ? (dailyData ?? monthlyData) : monthlyData.slice(-3)

  const n = data.length

  const selectionInfo = useMemo(() => {
    if (!selection || mode !== 'month') return null
    const minIdx = Math.min(selection.start, selection.end)
    const maxIdx = Math.max(selection.start, selection.end)
    
    let sum = 0
    for (let i = minIdx; i <= maxIdx; i++) {
      sum += data[i].total
    }

    const startItem = data[minIdx]
    const endItem = data[maxIdx]
    
    const getDetailedLabel = (item: typeof startItem) => {
      return 'dateLabel' in item && item.dateLabel ? item.dateLabel : ('month' in item ? item.month : ('day' in item ? item.day : ''))
    }

    const labelStart = getDetailedLabel(startItem)
    const labelEnd = getDetailedLabel(endItem)
    
    const dateRangeLabel = minIdx === maxIdx ? labelStart : `${labelStart} – ${labelEnd}`
    
    return {
      minIdx,
      maxIdx,
      totalSpent: sum,
      dateRangeLabel,
      xStart: getX(minIdx, n),
      xEnd: getX(maxIdx, n),
    }
  }, [selection, data, mode, n])

  const getIndexFromX = (clientX: number, currentTarget: SVGRectElement) => {
    const rect = currentTarget.getBoundingClientRect()
    const px = ((clientX - rect.left) / rect.width) * W
    let i = Math.round(((px - padL) / plotW) * (n - 1))
    i = Math.max(0, Math.min(n - 1, i))
    return i
  }

  const handleMouseDown = (e: MouseEvent<SVGRectElement>) => {
    if (mode !== 'month') return
    const idx = getIndexFromX(e.clientX, e.currentTarget)
    setSelection({ start: idx, end: idx })
    setIsDragging(true)
  }

  const handleMouseMove = (e: MouseEvent<SVGRectElement>) => {
    const i = getIndexFromX(e.clientX, e.currentTarget)
    setHover(i)

    if (isDragging && selection) {
      setSelection((prev) => prev ? { ...prev, end: i } : null)
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const totals = data.map((d) => d.total)
  const lo = Math.min(...totals)
  const hi = Math.max(...totals)
  const yMin = Math.max(0, lo - (hi - lo) * 0.4)
  const yMax = hi + (hi - lo) * 0.2
  const x = (i: number) => getX(i, n)
  const y = (v: number) => padT + (1 - (v - yMin) / (yMax - yMin || 1)) * plotH

  const ticks = 4
  const gridVals = Array.from({ length: ticks + 1 }, (_, k) => yMin + ((yMax - yMin) * k) / ticks)
  const linePts = data.map((d, i) => `${x(i)},${y(d.total)}`).join(' ')
  const areaPts = `${padL},${y(yMin)} ${linePts} ${x(n - 1)},${y(yMin)}`
  const mtdIndex = n - 1
  const totalShown = totals.reduce((a, b) => a + b, 0)
  const getLabel = (d: { month?: string; day?: string; total: number }) => ('month' in d ? d.month : d.day) ?? 'Unknown'

  return (
    <Card className="panel">
      <div className="panel-header" style={{ marginBottom: 4 }}>
        <span className="panel-title">Spend over time</span>
        <div className="panel-actions" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 2, backgroundColor: 'var(--elevated)', borderRadius: 6, padding: 4 }}>
            <button
              type="button"
              onClick={() => setMode('month')}
              aria-pressed={mode === 'month'}
              className={`btn-icon has-tip has-tip--bottom`}
              data-tip="This month"
              style={{
                backgroundColor: mode === 'month' ? 'var(--brand)' : 'transparent',
                color: mode === 'month' ? 'white' : 'inherit',
              }}
            >
              <Calendar size={14} />
            </button>
            <button
              type="button"
              onClick={() => setMode('quarter')}
              aria-pressed={mode === 'quarter'}
              className={`btn-icon has-tip has-tip--bottom`}
              data-tip="Last 3 months"
              style={{
                backgroundColor: mode === 'quarter' ? 'var(--brand)' : 'transparent',
                color: mode === 'quarter' ? 'white' : 'inherit',
              }}
            >
              <BarChart3 size={14} />
            </button>
          </div>
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
        <strong style={{ color: 'var(--text-primary)' }}>{eur(totalShown)}</strong>{' '}
        {mode === 'month' ? 'in this month' : 'across the last 3 months'}
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
              <tr key={getLabel(d)}>
                <td>{getLabel(d)}{i === mtdIndex ? ' (MTD)' : ''}</td>
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
            aria-label={`Total spend, from ${eur(data[0].total)} in ${getLabel(data[0])} to ${eur(data[mtdIndex].total)} month-to-date. Toggle the data table for exact figures.`}
          >
            <defs>
              <linearGradient id="spendArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.32" />
                <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
              </linearGradient>
              <clipPath id="plotClip">
                <rect x={padL} y={padT} width={plotW} height={plotH} />
              </clipPath>
            </defs>
            {/* Selection range highlight */}
            {selectionInfo && (
              <g clipPath="url(#plotClip)">
                <rect
                  x={selectionInfo.xStart - (plotW / (n - 1 || 1)) / 2}
                  y={padT}
                  width={selectionInfo.xEnd - selectionInfo.xStart + (plotW / (n - 1 || 1))}
                  height={plotH}
                  className="chart-selection-highlight"
                />
              </g>
            )}
            {/* Weekend background bands */}
            {mode === 'month' && (
              <g clipPath="url(#plotClip)">
                {data.map((d, i) => {
                  if (!('isWeekend' in d) || !d.isWeekend) return null
                  const colW = plotW / (n - 1 || 1)
                  return (
                    <rect
                      key={`weekend-${i}`}
                      x={x(i) - colW / 2}
                      y={padT}
                      width={colW}
                      height={plotH}
                      className="chart-weekend"
                    />
                  )
                })}
              </g>
            )}
            {gridVals.map((v, k) => (
              <g key={k}>
                <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} className="chart-grid" />
                <text x={padL - 8} y={y(v) + 4} className="chart-ylabel">€{Math.round(v)}</text>
              </g>
            ))}
            {data.map((d, i) => {
              const isDaily = 'weekday' in d
              const isWeekend = 'isWeekend' in d && d.isWeekend
              const weekday = ('weekday' in d && d.weekday) ? d.weekday : ''
              const day = ('day' in d && d.day) ? d.day : ''
              
              const shouldShow = !isDaily || n <= 10 || weekday === 'Mon' || weekday === 'Sat'

              const displayLabel = isDaily 
                ? (isWeekend ? `${weekday.toUpperCase()} ${day}` : `${weekday} ${day}`)
                : getLabel(d)

              return (
                <text
                  key={getLabel(d)}
                  x={x(i)}
                  y={H - 12}
                  className={`chart-xlabel ${isWeekend ? 'is-weekend' : ''}`}
                >
                  {shouldShow ? displayLabel : ''}
                </text>
              )
            })}
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
              data-testid="chart-overlay"
              x={padL}
              y={padT}
              width={plotW}
              height={plotH}
              fill="transparent"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={() => {
                setHover(null)
                setIsDragging(false)
              }}
              style={{ cursor: mode === 'month' ? 'ew-resize' : 'default' }}
            />
          </svg>
          {hover !== null && (
            <div className="chart-tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
              <div className="chart-tip-head">
                {'dateLabel' in data[hover] && data[hover].dateLabel ? data[hover].dateLabel : getLabel(data[hover])}
                {hover === mtdIndex ? ' · MTD' : ''}
              </div>
              <div className="chart-tip-row">
                <span className="dot" style={{ background: 'var(--brand)' }} />
                <span className="nm">Total spend</span>
                <span className="vl">{eur(data[hover].total)}</span>
              </div>
            </div>
          )}
          {/* Summary Badge for selection */}
          {selectionInfo && (
            <div className="chart-selection-badge">
              <div className="badge-meta">
                <span className="lbl">Selected Period: {selectionInfo.dateRangeLabel}</span>
                <span className="val">Total Spent: {eur(selectionInfo.totalSpent)}</span>
              </div>
              <button
                type="button"
                className="badge-close"
                onClick={() => setSelection(null)}
                aria-label="Clear selection"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
