// Budget domain types mirroring the backend BudgetView (camelCase) and the
// spend taxonomy used to scope CATEGORY budgets. Wired to /api/budgets and
// /api/reference/categories — no mock data.

export type BudgetScope = 'TOTAL' | 'CATEGORY' | 'MEMBER' | 'HOUSEHOLD'
export type BudgetPeriod = 'WEEK' | 'MONTH'

export interface Budget {
  id: string
  scope: BudgetScope
  categoryId: string | null
  memberUserId: string | null
  amount: number
  period: BudgetPeriod
  accumulated: number
  alert85Fired: boolean
  alert100Fired: boolean
  alert85At: string | null
  alert100At: string | null
  cycleStart: string
}

export interface Category {
  id: string
  name: string
  parentId: string | null
}

export interface HouseholdMemberLite {
  userId: string
  fullName: string
  email: string
  isOwner: boolean
}

export const MAX_BUDGETS = 10

export const budgetPercent = (b: Budget): number =>
  b.amount > 0 ? Math.round((b.accumulated / b.amount) * 100) : 0

export const periodLabel = (p: BudgetPeriod): string => (p === 'WEEK' ? 'Weekly' : 'Monthly')

// Human label for a budget's scope. CATEGORY/MEMBER resolve their target name
// from the supplied lookups, falling back to a neutral label when absent.
// HOUSEHOLD covers every member; an optional category narrows it.
export function scopeLabel(
  b: Budget,
  categories: Map<string, string>,
  members: Map<string, string>,
): string {
  if (b.scope === 'TOTAL') return 'All spending'
  if (b.scope === 'CATEGORY') return categories.get(b.categoryId ?? '') ?? 'Category'
  if (b.scope === 'HOUSEHOLD') {
    if (!b.categoryId) return 'Household — all spending'
    return `Household — ${categories.get(b.categoryId) ?? 'category'}`
  }
  return members.get(b.memberUserId ?? '') ?? 'Member'
}
