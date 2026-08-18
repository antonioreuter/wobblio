import { render, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { LineChart } from './line-chart'

// Structural clone of the ChartSeries fields the chart consumes.
interface Series {
  id: string
  name: string
  color: string
  data: (number | null)[]
  discounts: (number | null)[]
  stale: boolean
  own?: boolean
}

const series = (over: Partial<Series> = {}): Series => ({
  id: 's1',
  name: 'Halfvolle melk · Your purchases',
  color: '#6366f1',
  data: [1.29],
  discounts: [null],
  stale: false,
  own: true,
  ...over,
})

const draw = (s: Series[], months: string[], currency: string | null = 'EUR') =>
  render(<LineChart series={s} months={months} currency={currency} />).container

const points = (c: HTMLElement) => c.querySelectorAll('.chart-point')
const runs = (c: HTMLElement) => c.querySelectorAll('polyline')
const gaps = (c: HTMLElement) => c.querySelectorAll('.chart-gap')

describe('LineChart — a lone observation', () => {
  // The reported bug: one purchase used to render as a bare r=2.5 circle with no line and no
  // label, which reads as "the chart isn't drawing".
  it('renders a marker and spells out its value', () => {
    const c = draw([series()], ['6 Apr'])

    expect(points(c)).toHaveLength(1)
    expect(points(c)[0].getAttribute('r')).toBe('3.5')
    expect(c.querySelector('.chart-point-label')?.textContent).toContain('1,29')
  })

  it('labels a lone promo-only observation too', () => {
    const c = draw([series({ data: [null], discounts: [0.99] })], ['6 Apr'])
    expect(c.querySelector('.chart-point-label')?.textContent).toContain('0,99')
  })

  it('does not label a series that has more than one observation', () => {
    const c = draw([series({ data: [1.29, 1.35], discounts: [null, null] })], ['6 Apr', '13 Apr'])
    expect(c.querySelector('.chart-point-label')).toBeNull()
  })
})

describe('LineChart — promo-only series', () => {
  // Used to render two bare diamonds and nothing else.
  it('draws a connected promo track with its own markers', () => {
    const c = draw([series({ data: [null, null], discounts: [1.49, 1.59] })], ['6 Apr', '13 Apr'])

    expect(points(c)).toHaveLength(2)
    expect(c.querySelectorAll('.chart-promo-link')).toHaveLength(1)
    // Promo markers stay diamonds — §6.5.1 keeps promo a distinct signal, never blended.
    expect(c.querySelectorAll('path.chart-point')).toHaveLength(2)
  })
})

describe('LineChart — gaps', () => {
  it('splits into solid runs joined by one dotted connector', () => {
    const c = draw([series({ data: [1.29, null, null, 1.49], discounts: [null, null, null, null], own: false })], [
      '6 Apr', '13 Apr', '20 Apr', '27 Apr',
    ])

    expect(runs(c)).toHaveLength(0) // both runs are single points…
    expect(points(c)).toHaveLength(2) // …so each is a marker
    expect(gaps(c)).toHaveLength(1)
  })

  it('keeps consecutive weeks solid and only bridges the hole', () => {
    const c = draw([series({ data: [1.2, 1.25, null, 1.4, 1.45], discounts: [null, null, null, null, null], own: false })], [
      '6 Apr', '13 Apr', '20 Apr', '27 Apr', '4 May',
    ])

    expect(runs(c)).toHaveLength(2)
    expect(gaps(c)).toHaveLength(1)
    expect(points(c)).toHaveLength(4)
  })

  it('marks every observed week', () => {
    const c = draw([series({ data: [1.2, 1.25, 1.3], discounts: [null, null, null], own: false })], ['6 Apr', '13 Apr', '20 Apr'])
    expect(points(c)).toHaveLength(3)
  })
})

describe('LineChart — currency and accessibility', () => {
  it('renders the view currency on the axis, never a hardcoded euro', () => {
    const c = draw([series({ data: [1.29, 1.35], discounts: [null, null] })], ['6 Apr', '13 Apr'], 'GBP')
    const axis = [...c.querySelectorAll('text.chart-ylabel')].map((t) => t.textContent).join(' ')
    expect(axis).toContain('£')
    expect(axis).not.toContain('€')
  })

  it('describes the series and points at the data table', () => {
    const c = draw([series({ data: [1.29, 1.49], discounts: [null, null] })], ['6 Apr', '13 Apr'])
    const label = c.querySelector('svg')?.getAttribute('aria-label') ?? ''
    expect(label).toContain('1 series')
    expect(label).toContain('6 Apr')
    expect(label).toContain('13 Apr')
    expect(label).toMatch(/data table/i)
  })

  it('thins the x-axis labels instead of crowding them', () => {
    const months = Array.from({ length: 26 }, (_, i) => `w${i}`)
    const c = draw([series({ data: months.map(() => 1.2), discounts: months.map(() => null), own: false })], months)
    // 26 weeks previously emitted 13 labels; the adaptive step keeps it under ten.
    expect(c.querySelectorAll('text.chart-xlabel').length).toBeLessThanOrEqual(10)
  })
})

describe('LineChart — hover', () => {
  it('shows the week and each series value on hover', () => {
    const c = draw(
      [series({ data: [1.29, 1.49], discounts: [null, 0.99] })],
      ['6 Apr', '13 Apr'],
    )
    const overlay = c.querySelector('rect[fill="transparent"]') as SVGRectElement
    // jsdom returns a zeroed rect, so the plot geometry has to be supplied.
    overlay.getBoundingClientRect = vi.fn().mockReturnValue({
      left: 46, width: 696, top: 18, height: 266, right: 742, bottom: 284,
      x: 46, y: 18, toJSON: () => ({}),
    })

    fireEvent.mouseMove(overlay, { clientX: 742 })

    expect(c.querySelector('.chart-tip-head')?.textContent).toBe('13 Apr')
    // Regular median and its promo, both surfaced and kept distinct.
    expect(c.querySelector('.chart-tip-row .vl')?.textContent).toMatch(/1,49.*promo.*0,99/)
  })
})
