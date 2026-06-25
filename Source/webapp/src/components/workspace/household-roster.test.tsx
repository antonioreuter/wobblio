import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { HouseholdRoster } from './household-roster'
import { type HouseholdMember } from './household-data'

const member = (overrides: Partial<HouseholdMember>): HouseholdMember => ({
  userId: 'u-1',
  email: 'owner@wobblio.nl',
  fullName: 'Anna Jansen',
  isOwner: false,
  uploadsThisWeek: 0,
  ...overrides,
})

const owner = member({ userId: 'u-1', fullName: 'Anna Jansen', isOwner: true, uploadsThisWeek: 4 })
const other = member({ userId: 'u-2', email: 'bram@wobblio.nl', fullName: 'Bram', uploadsThisWeek: 2 })

describe('HouseholdRoster', () => {
  it('renders a row per member with name, email and weekly uploads', () => {
    render(<HouseholdRoster members={[owner, other]} currentUserId="u-1" />)
    expect(screen.getByTestId('household-member-u-1')).toHaveTextContent('Anna Jansen')
    expect(screen.getByTestId('household-member-u-1')).toHaveTextContent('Owner')
    expect(screen.getByTestId('household-member-u-2')).toHaveTextContent('bram@wobblio.nl')
    expect(screen.getByTestId('household-member-u-2')).toHaveTextContent('2')
  })

  it('marks the signed-in member with a You hint', () => {
    render(<HouseholdRoster members={[owner, other]} currentUserId="u-2" />)
    expect(screen.getByTestId('household-member-u-2')).toHaveTextContent('You')
    expect(screen.getByTestId('household-member-u-1')).not.toHaveTextContent('You')
  })

  it('shows a remove button only for non-owner members when onRemove is given', () => {
    const onRemove = vi.fn()
    render(<HouseholdRoster members={[owner, other]} currentUserId="u-1" onRemove={onRemove} />)

    // Owner row never removable.
    expect(within(screen.getByTestId('household-member-u-1')).queryByTestId('household-remove-u-1'))
      .toBeNull()

    fireEvent.click(within(screen.getByTestId('household-member-u-2')).getByTestId('household-remove-u-2'))
    expect(onRemove).toHaveBeenCalledWith(other)
  })

  it('renders no remove buttons for non-owners (no onRemove handler)', () => {
    render(<HouseholdRoster members={[owner, other]} currentUserId="u-2" />)
    expect(screen.queryByTestId('household-remove-u-2')).toBeNull()
  })
})
