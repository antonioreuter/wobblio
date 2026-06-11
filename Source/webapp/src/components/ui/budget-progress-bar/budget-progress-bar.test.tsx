import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BudgetProgressBar } from './budget-progress-bar'

describe('BudgetProgressBar', () => {
  it('renders label and amounts', () => {
    render(<BudgetProgressBar label="Groceries" spent={340} limit={500} />)
    expect(screen.getByText('Groceries')).toBeTruthy()
  })

  it('shows warning indicator when over 85%', () => {
    render(<BudgetProgressBar label="Dining" spent={261} limit={300} />)
    const warning = screen.getByLabelText('Budget warning')
    expect(warning).toBeTruthy()
  })

  it('does not show warning indicator when under 85%', () => {
    render(<BudgetProgressBar label="Transport" spent={78} limit={150} />)
    expect(screen.queryByLabelText('Budget warning')).toBeNull()
  })

  it('has correct aria attributes on progress bar', () => {
    render(<BudgetProgressBar label="Groceries" spent={340} limit={500} />)
    const bar = screen.getByRole('progressbar')
    expect(bar.getAttribute('aria-valuenow')).toBe('68')
    expect(bar.getAttribute('aria-valuemin')).toBe('0')
    expect(bar.getAttribute('aria-valuemax')).toBe('100')
  })
})
