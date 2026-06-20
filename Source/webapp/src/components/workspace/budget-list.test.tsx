import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { BudgetList } from './budget-list'
import { type Budget } from './budget-data'

const budget = (overrides: Partial<Budget>): Budget => ({
  id: 'b-1',
  scope: 'TOTAL',
  categoryId: null,
  memberUserId: null,
  amount: 200,
  period: 'MONTH',
  accumulated: 50,
  alert85Fired: false,
  alert100Fired: false,
  alert85At: null,
  alert100At: null,
  cycleStart: '2026-06-01',
  ...overrides,
})

const categories = new Map([['cat-groceries', 'Groceries']])
const members = new Map<string, string>()

describe('BudgetList', () => {
  it('renders a row per budget with its resolved name and percentage', () => {
    render(
      <BudgetList
        budgets={[
          budget({ id: 'b-1', scope: 'TOTAL', accumulated: 50, amount: 200 }),
          budget({ id: 'b-2', scope: 'CATEGORY', categoryId: 'cat-groceries', accumulated: 220, amount: 200 }),
        ]}
        categories={categories}
        members={members}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    const rows = screen.getAllByTestId('budget-row')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('All spending')
    expect(rows[0]).toHaveTextContent('25%')
    expect(rows[1]).toHaveTextContent('Groceries')
    expect(rows[1]).toHaveTextContent('110%')
  })

  it('shows alert history only when a budget has fired', () => {
    render(
      <BudgetList
        budgets={[budget({ alert85At: '2026-06-10T00:00:00Z', alert100At: '2026-06-12T00:00:00Z' })]}
        categories={categories}
        members={members}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.getByText(/85% reached/)).toBeInTheDocument()
    expect(screen.getByText(/Over budget/)).toBeInTheDocument()
  })

  it('routes edit and delete actions for the right budget', () => {
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    const b = budget({ id: 'b-7' })
    render(
      <BudgetList budgets={[b]} categories={categories} members={members} onEdit={onEdit} onDelete={onDelete} />,
    )

    const row = screen.getByTestId('budget-row')
    fireEvent.click(within(row).getByTestId('budget-edit'))
    fireEvent.click(within(row).getByTestId('budget-delete'))

    expect(onEdit).toHaveBeenCalledWith(b)
    expect(onDelete).toHaveBeenCalledWith(b)
  })
})
