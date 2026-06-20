import { describe, it, expect } from 'vitest'
import { budgetPercent, periodLabel, scopeLabel, type Budget } from './budget-data'

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

describe('budgetPercent', () => {
  it('rounds accumulated as a percentage of the limit', () => {
    expect(budgetPercent(budget({ accumulated: 50, amount: 200 }))).toBe(25)
    expect(budgetPercent(budget({ accumulated: 170, amount: 200 }))).toBe(85)
    expect(budgetPercent(budget({ accumulated: 260, amount: 200 }))).toBe(130)
  })

  it('returns 0 for a non-positive limit instead of dividing by zero', () => {
    expect(budgetPercent(budget({ amount: 0 }))).toBe(0)
  })
})

describe('periodLabel', () => {
  it('maps the period enum to a human label', () => {
    expect(periodLabel('WEEK')).toBe('Weekly')
    expect(periodLabel('MONTH')).toBe('Monthly')
  })
})

describe('scopeLabel', () => {
  const categories = new Map([['cat-groceries', 'Groceries']])
  const members = new Map([['u-2', 'Jamie']])

  it('labels a TOTAL budget', () => {
    expect(scopeLabel(budget({ scope: 'TOTAL' }), categories, members)).toBe('All spending')
  })

  it('resolves a CATEGORY budget name, falling back when unknown', () => {
    expect(scopeLabel(budget({ scope: 'CATEGORY', categoryId: 'cat-groceries' }), categories, members)).toBe('Groceries')
    expect(scopeLabel(budget({ scope: 'CATEGORY', categoryId: 'cat-x' }), categories, members)).toBe('Category')
  })

  it('resolves a MEMBER budget name, falling back when unknown', () => {
    expect(scopeLabel(budget({ scope: 'MEMBER', memberUserId: 'u-2' }), categories, members)).toBe('Jamie')
    expect(scopeLabel(budget({ scope: 'MEMBER', memberUserId: 'u-9' }), categories, members)).toBe('Member')
  })

  it('labels a HOUSEHOLD budget with no category as all spending', () => {
    expect(scopeLabel(budget({ scope: 'HOUSEHOLD', categoryId: null }), categories, members)).toBe('Household — all spending')
  })

  it('labels a HOUSEHOLD budget with a category, falling back when unknown', () => {
    expect(scopeLabel(budget({ scope: 'HOUSEHOLD', categoryId: 'cat-groceries' }), categories, members)).toBe('Household — Groceries')
    expect(scopeLabel(budget({ scope: 'HOUSEHOLD', categoryId: 'cat-x' }), categories, members)).toBe('Household — category')
  })
})
