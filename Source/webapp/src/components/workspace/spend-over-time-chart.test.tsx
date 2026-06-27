import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SpendOverTimeChart } from './spend-over-time-chart'

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

  it('performs period range selection on drag and displays the summary badge', () => {
    render(<SpendOverTimeChart dailyData={dailyDataMock} />)

    const overlay = screen.getByTestId('chart-overlay')
    overlay.getBoundingClientRect = vi.fn().mockReturnValue({
      left: 0,
      width: 760,
      top: 0,
      height: 300,
      right: 760,
      bottom: 300,
    })

    // Drag from index 7 (Day 8: total = 80) to index 9 (Day 10: total = 100)
    // clientX coordinate mapping:
    // padL = 52, plotW = 690, n = 15.
    // x(i) = 52 + (i / 14) * 690
    // x(7) = 52 + 0.5 * 690 = 397
    // x(9) = 52 + (9/14) * 690 = 495.4

    // Start dragging
    fireEvent.mouseDown(overlay, { clientX: 397 })
    // Move dragging
    fireEvent.mouseMove(overlay, { clientX: 495 })
    // Finish dragging
    fireEvent.mouseUp(overlay)

    // Sum should be 80 + 90 + 100 = 270
    // Date range should be: Mon, Jun 8 – Wed, Jun 10
    expect(screen.getByText('Selected Period: Mon, Jun 8 – Wed, Jun 10')).toBeInTheDocument()
    expect(screen.getByText('Total Spent: €270.00')).toBeInTheDocument()

    // Clear selection
    const clearButton = screen.getByLabelText('Clear selection')
    fireEvent.click(clearButton)

    // The selection summary badge should be removed
    expect(screen.queryByText('Total Spent: €270.00')).not.toBeInTheDocument()
  })
})
