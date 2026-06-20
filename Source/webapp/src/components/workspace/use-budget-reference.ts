'use client'

import { useEffect, useMemo, useState } from 'react'
import { type Category, type HouseholdMemberLite } from './budget-data'

interface HouseholdDetail {
  ownerUserId: string
  members: HouseholdMemberLite[]
}

export interface BudgetReference {
  categories: Category[]
  members: HouseholdMemberLite[]
  isHouseholdOwner: boolean
  categoryNames: Map<string, string>
  memberNames: Map<string, string>
}

// Reference data for rendering and configuring budgets: the spend taxonomy
// (CATEGORY scope) and the caller's household roster (MEMBER scope). Both are
// resolved into id→name maps for label lookup. Fetches only when `enabled`
// (Premium) — non-Premium users have no budgets to label.
export function useBudgetReference(enabled: boolean, userId?: string): BudgetReference {
  const [categories, setCategories] = useState<Category[]>([])
  const [household, setHousehold] = useState<HouseholdDetail | null>(null)

  useEffect(() => {
    if (!enabled) return
    fetch('/api/reference/categories', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { categories: [] }))
      .then((d: { categories: Category[] }) => setCategories(d.categories))
      .catch(() => undefined)
    fetch('/api/households/mine', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { household: null }))
      .then((d: { household: HouseholdDetail | null }) => setHousehold(d.household))
      .catch(() => undefined)
  }, [enabled])

  const members = useMemo(() => household?.members ?? [], [household])
  const categoryNames = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])
  const memberNames = useMemo(
    () => new Map(members.map((m) => [m.userId, m.fullName || m.email])),
    [members],
  )
  const isHouseholdOwner = Boolean(household && userId && household.ownerUserId === userId)

  return { categories, members, isHouseholdOwner, categoryNames, memberNames }
}
