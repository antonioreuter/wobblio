import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SpendOverTimeChart } from './spend-over-time-chart'

// jsdom has no PointerEvent; without this, fireEvent.pointerDown drops clientX.
if (!window.PointerEvent) {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params)
      this.pointerId = params.pointerId ?? 1
    }
  }
  window.PointerEvent = PointerEventPolyfill as typeof window.PointerEvent
}

vi.mock('@/components/ds', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className} data-testid="card-mock">
      {children}
    </div>
  ),
}))

describe('SpendOverTimeChart', () => {
  const dailyDataMock = [
    { day: '1', total: 10, isWeekend: false, weekday: 'Mon', dateLabel: 'Mon, Jun 1' },
    { day: '2', total: 20, isWeekend: false, weekday: 'Tue', dateLabel: 'Tue, Jun 2' },
    { day: '3', total: 30, isWeekend: false, weekday: 'Wed', dateLabel: 'Wed, Jun 3' },
    { day: '4', total: 40, isWeekend: false, weekday: 'Thu', dateLabel: 'Thu, Jun 4' },
    { day: '5', total: 50, isWeekend: false, weekday: 'Fri', dateLabel: 'Fri, Jun 5' },
    { day: '6', total: 60, isWeekend: true, weekday: 'Sat', dateLabel: 'Sat, Jun 6' },
    { day: '7', total: 70, isWeekend: true, weekday: 'Sun', dateLabel: 'Sun, Jun 7' },
    { day: '8', total: 80, isWeekend: false, weekday: 'Mon', dateLabel: 'Mon, Jun 8' },
    { day: '9', total: 90, isWeekend: false, weekday: 'Tue', dateLabel: 'Tue, Jun 9' },
    { day: '10', total: 100, isWeekend: false, weekday: 'Wed', dateLabel: 'Wed, Jun 10' },
    { day: '11', total: 110, isWeekend: false, weekday: 'Thu', dateLabel: 'Thu, Jun 11' },
    { day: '12', total: 120, isWeekend: false, weekday: 'Fri', dateLabel: 'Fri, Jun 12' },
    { day: '13', total: 130, isWeekend: true, weekday: 'Sat', dateLabel: 'Sat, Jun 13' },
    { day: '14', total: 140, isWeekend: true, weekday: 'Sun', dateLabel: 'Sun, Jun 14' },
    { day: '15', total: 150, isWeekend: false, weekday: 'Mon', dateLabel: 'Mon, Jun 15' },
  ]

  it('renders x-axis labels with the weekend/weekday decluttering rules', () => {
    const { container } = render(
      <SpendOverTimeChart dailyData={dailyDataMock} />
    )

    // With n = 15 (>10), we only show Mondays and Saturdays.
    // Mondays: Day 1 (Mon 1), Day 8 (Mon 8), Day 15 (Mon 15)
    // Saturdays: Day 6 (SAT 6), Day 13 (SAT 13)
    // Sunday (Day 7, 14) and other days should have empty text labels.
    const textElements = container.querySelectorAll('text.chart-xlabel')
    expect(textElements).toHaveLength(15)

    expect(textElements[0].textContent).toBe('Mon 1')
    expect(textElements[1].textContent).toBe('') // Tue 2
    expect(textElements[4].textContent).toBe('') // Fri 5
    expect(textElements[5].textContent).toBe('SAT 6') // Sat 6 (isWeekend is true, uppercase SAT)
    expect(textElements[6].textContent).toBe('') // Sun 7 (weekend, but not Sat/Mon)
    expect(textElements[7].textContent).toBe('Mon 8')
    expect(textElements[12].textContent).toBe('SAT 13')
    expect(textElements[14].textContent).toBe('Mon 15')
  })

  // The interaction overlay covers exactly the plot area (x = padL..padL+plotW),
  // so its client rect starts at padL and spans plotW at 1:1 scale.
  const mockOverlayRect = (overlay: HTMLElement) => {
    overlay.getBoundingClientRect = vi.fn().mockReturnValue({
      left: 52,
      width: 690,
      top: 20,
      height: 246,
      right: 742,
      bottom: 266,
    })
  }

  // clientX coordinate mapping (plot-area geometry):
  // x(i) = 52 + (i / 14) * 690 → x(7) = 397, x(9) ≈ 495.4
  const dragSelection = (overlay: HTMLElement, fromX: number, toX: number) => {
    fireEvent.pointerDown(overlay, { clientX: fromX })
    fireEvent.pointerMove(overlay, { clientX: toX })
    fireEvent.pointerUp(overlay)
  }

  it('performs period range selection on drag and shows total, day count, and daily average', () => {
    render(<SpendOverTimeChart dailyData={dailyDataMock} />)

    const overlay = screen.getByTestId('chart-overlay')
    mockOverlayRect(overlay)

    // Drag from index 7 (Day 8: total = 80) to index 9 (Day 10: total = 100)
    dragSelection(overlay, 397, 495)

    // Sum = 80 + 90 + 100 = 270 over 3 days → €90.00/day
    const summary = screen.getByTestId('chart-selection-summary')
    expect(summary).toHaveTextContent('Mon, Jun 8 – Wed, Jun 10 · 3 days')
    expect(summary).toHaveTextContent('€270.00 total · €90.00/day')

    // Clear selection via the close button
    fireEvent.click(screen.getByLabelText('Clear selection'))
    expect(screen.queryByTestId('chart-selection-summary')).not.toBeInTheDocument()
  })

  it('does not create a selection on a plain click, and a click clears an existing one', () => {
    render(<SpendOverTimeChart dailyData={dailyDataMock} />)

    const overlay = screen.getByTestId('chart-overlay')
    mockOverlayRect(overlay)

    // Plain click (down + up, no movement) creates nothing
    fireEvent.pointerDown(overlay, { clientX: 397 })
    fireEvent.pointerUp(overlay)
    expect(screen.queryByTestId('chart-selection-summary')).not.toBeInTheDocument()

    // Drag to create a selection, then a plain click clears it
    dragSelection(overlay, 397, 495)
    expect(screen.getByTestId('chart-selection-summary')).toBeInTheDocument()

    fireEvent.pointerDown(overlay, { clientX: 200 })
    fireEvent.pointerUp(overlay)
    expect(screen.queryByTestId('chart-selection-summary')).not.toBeInTheDocument()
  })

  it('clears the selection on Escape', () => {
    render(<SpendOverTimeChart dailyData={dailyDataMock} />)

    const overlay = screen.getByTestId('chart-overlay')
    mockOverlayRect(overlay)
    dragSelection(overlay, 397, 495)
    expect(screen.getByTestId('chart-selection-summary')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('chart-selection-summary')).not.toBeInTheDocument()
  })

  it('clears the selection when switching view mode', () => {
    const { container } = render(
      <SpendOverTimeChart
        data={[
          { month: 'Apr', total: 100 },
          { month: 'May', total: 200 },
          { month: 'Jun', total: 300 },
        ]}
        dailyData={dailyDataMock}
      />
    )

    const overlay = screen.getByTestId('chart-overlay')
    mockOverlayRect(overlay)
    dragSelection(overlay, 397, 495)
    expect(screen.getByTestId('chart-selection-summary')).toBeInTheDocument()

    const quarterButton = container.querySelector('[data-tip="Last 3 months"]') as HTMLElement
    fireEvent.click(quarterButton)
    expect(screen.queryByTestId('chart-selection-summary')).not.toBeInTheDocument()

    // Returning to month view must not resurrect the stale selection
    const monthButton = container.querySelector('[data-tip="This month"]') as HTMLElement
    fireEvent.click(monthButton)
    expect(screen.queryByTestId('chart-selection-summary')).not.toBeInTheDocument()
  })
})
