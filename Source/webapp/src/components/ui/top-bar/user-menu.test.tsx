import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { UserMenu } from './user-menu'

vi.mock('next-auth/react', () => ({ signOut: vi.fn() }))

describe('UserMenu role badge', () => {
  beforeEach(() => cleanup())

  it.each([
    ['STANDARD', 'Standard', 'plan-chip--standard'],
    ['PREMIUM', 'Premium', 'plan-chip--premium'],
    ['TESTER', 'Tester', 'plan-chip--tester'],
    ['ADMIN', 'Admin', 'plan-chip--admin'],
  ])('renders the %s badge', (role, label, variantClass) => {
    render(<UserMenu userInitials="AR" userRole={role} />)
    const badge = screen.getByTestId('topbar-plan')
    expect(badge).toHaveTextContent(label)
    expect(badge.className).toContain(variantClass)
  })

  it('falls back to the Standard badge for an unknown role', () => {
    render(<UserMenu userInitials="AR" userRole="MYSTERY" />)
    const badge = screen.getByTestId('topbar-plan')
    expect(badge).toHaveTextContent('Standard')
    expect(badge.className).toContain('plan-chip--standard')
  })
})
