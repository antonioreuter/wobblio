import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LeftNav } from './left-nav'

describe('LeftNav', () => {
  it('never renders an Admin nav item for non-ADMIN role', () => {
    render(<LeftNav userRole="STANDARD" />)
    expect(screen.queryByRole('link', { name: /admin/i })).not.toBeInTheDocument()
  })

  it('renders Admin nav item for ADMIN role', () => {
    render(<LeftNav userRole="ADMIN" />)
    expect(screen.getByRole('link', { name: /admin/i })).toBeInTheDocument()
  })
})
