import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatCard } from './stat-card'

describe('StatCard', () => {
  it('renders label', () => {
    render(<StatCard label="Month-to-date spend" amount={1284.5} />)
    expect(screen.getByText('Month-to-date spend')).toBeTruthy()
  })

  it('renders string value', () => {
    render(<StatCard label="Scans remaining" value="3" />)
    expect(screen.getByText('3')).toBeTruthy()
  })

  it('renders delta chip when delta is provided', () => {
    render(<StatCard label="Budget" amount={1284.5} delta={8.3} deltaLabel="vs May" />)
    expect(screen.getByText('vs May')).toBeTruthy()
  })
})
