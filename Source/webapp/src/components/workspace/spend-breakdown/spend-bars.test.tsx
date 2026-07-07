import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SpendBars } from './spend-bars'
import type { SpendNode } from './use-spend-breakdown'

vi.mock('@/components/ds', () => ({
  CategoryIcon: () => <span data-testid="cat-icon" />,
}))

const nodes: SpendNode[] = [
  { id: 'cat-groceries', name: 'Groceries', amount: 75, pct: 75, count: 10 },
  { id: 'cat-groceries-discount', name: 'Bonus & Discounts', amount: -5, pct: -5, count: 1 },
]

describe('SpendBars', () => {
  it('drills when a drillable row is clicked', () => {
    const onDrill = vi.fn()
    render(
      <SpendBars nodes={nodes} level="categories" currency="EUR" drillable locked={false} onDrill={onDrill} onLocked={vi.fn()} />,
    )
    fireEvent.click(screen.getByTestId('spend-node-cat-groceries'))
    expect(onDrill).toHaveBeenCalledWith(expect.objectContaining({ id: 'cat-groceries' }))
  })

  it('opens the upsell (not a drill) when the row is locked', () => {
    const onDrill = vi.fn()
    const onLocked = vi.fn()
    render(
      <SpendBars nodes={nodes} level="merchants" currency="EUR" drillable={false} locked onDrill={onDrill} onLocked={onLocked} />,
    )
    fireEvent.click(screen.getByTestId('spend-node-cat-groceries'))
    expect(onLocked).toHaveBeenCalledTimes(1)
    expect(onDrill).not.toHaveBeenCalled()
  })

  it('renders a helpful empty state when there are no nodes', () => {
    render(<SpendBars nodes={[]} level="categories" currency="EUR" drillable locked={false} onDrill={vi.fn()} onLocked={vi.fn()} />)
    expect(screen.getByTestId('spend-empty')).toBeInTheDocument()
  })
})
