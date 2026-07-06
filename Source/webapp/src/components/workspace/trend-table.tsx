'use client'

import { formatViewMoney } from '@/lib/currency'

// Structural shape the price-trends chart series already satisfies — the table renders the SAME
// visible series/weeks as the chart (a11y parity, webapp brief "every chart paired with a table").
export interface TrendTableSeries {
  id: string
  product: string
  merchant: string
  color: string
  data: (number | null)[] // weekly median per week in `labels`
  discounts: (number | null)[] // weekly discounted median, shown as a distinct promo value
  stale: boolean
  staleDays: number
}

interface TrendTableProps {
  series: TrendTableSeries[]
  labels: string[] // the shared week axis, chronological (matches the chart's left→right)
  currency: string | null
}

// The chart's data-table twin. Rows = weeks (chronological, same direction as the chart x-axis),
// columns = series. Empty weeks render an em dash — never interpolated. Discounts are shown as a
// distinct promo value, mirroring the chart's diamond markers. Full keyboard/screen-reader access.
export function TrendTable({ series, labels, currency }: TrendTableProps) {
  const money = (v: number) => formatViewMoney(v, currency)
  return (
    <div className="table-scroll trend-table-wrap">
      <table className="app-table trend-table" data-testid="trends-table">
        <thead>
          <tr>
            <th scope="col">Week</th>
            {series.map((s) => (
              <th scope="col" className="num" key={s.id}>
                <span className="trend-th-name">
                  <span className="dot" style={{ background: s.color, opacity: s.stale ? 0.5 : 1 }} />
                  {s.product} · {s.merchant}
                </span>
                {s.stale && <span className="trend-th-stale">stale · {s.staleDays}d</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((label, w) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              {series.map((s) => {
                const median = s.data[w]
                const promo = s.discounts[w]
                return (
                  <td className="num" key={s.id}>
                    {median !== null ? money(median) : <span className="trend-cell-empty">—</span>}
                    {promo !== null && <span className="trend-cell-promo">promo {money(promo)}</span>}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
