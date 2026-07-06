import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { TrendTable, type TrendTableSeries } from './trend-table'

const labels = ['1 May', '8 May', '15 May']

const series: TrendTableSeries[] = [
  {
    id: 'p1|m1',
    product: 'Milk',
    merchant: 'Albert Heijn',
    color: '#6366f1',
    data: [1.2, null, 1.35], // a gap in the middle week
    discounts: [null, null, 0.99], // a promo on the last week
    stale: false,
    staleDays: 0,
  },
  {
    id: 'p1|m2',
    product: 'Milk',
    merchant: 'Jumbo',
    color: '#0d9488',
    data: [1.1, 1.15, 1.18],
    discounts: [null, null, null],
    stale: true,
    staleDays: 40,
  },
]

describe('TrendTable', () => {
  it('renders one row per week and one column per series', () => {
    render(<TrendTable series={series} labels={labels} currency="EUR" />)
    // header: Week + the two series (merchant text lives in its own node next to the colour dot)
    expect(screen.getByText(/Albert Heijn/)).toBeInTheDocument()
    expect(screen.getByText(/Jumbo/)).toBeInTheDocument()
    // one body row per label
    labels.forEach((l) => expect(screen.getByText(l)).toBeInTheDocument())
  })

  it('renders the view currency, an em dash for gaps, and a distinct promo value', () => {
    render(<TrendTable series={series} labels={labels} currency="GBP" />)
    // GBP symbol, not a hardcoded euro
    expect(screen.getAllByText(/£/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/€/)).not.toBeInTheDocument()
    // the missing AH week renders an em dash, never interpolated
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1)
    // the promo is shown distinctly
    expect(screen.getByText(/promo/i)).toBeInTheDocument()
  })

  it('flags a stale series column', () => {
    render(<TrendTable series={series} labels={labels} currency="EUR" />)
    const jumboHeader = screen.getByText(/Jumbo/).closest('th')!
    expect(within(jumboHeader).getByText(/stale · 40d/)).toBeInTheDocument()
  })
})
