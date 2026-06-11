import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LeftNav } from './left-nav'

describe('LeftNav', () => {
  it('never renders an Admin nav item', () => {
    render(<LeftNav onNavigate={() => {}} />)
    expect(screen.queryByRole('button', { name: /admin/i })).not.toBeInTheDocument()
  })
})
