import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConfidenceBadge } from './confidence-badge'

describe('ConfidenceBadge', () => {
  it('renders confirmed state', () => {
    render(<ConfidenceBadge confidence="confirmed" />)
    expect(screen.getByText('Confirmed')).toBeTruthy()
    expect(screen.getByTestId('confidence-badge-confirmed')).toBeTruthy()
  })

  it('renders auto state', () => {
    render(<ConfidenceBadge confidence="auto" />)
    expect(screen.getByText('Auto')).toBeTruthy()
  })

  it('renders low state', () => {
    render(<ConfidenceBadge confidence="low" />)
    expect(screen.getByText('Low')).toBeTruthy()
  })

  it('applies amber styling for low confidence', () => {
    render(<ConfidenceBadge confidence="low" />)
    const badge = screen.getByTestId('confidence-badge-low')
    expect(badge.className).toContain('bg-amber-50')
  })
})
