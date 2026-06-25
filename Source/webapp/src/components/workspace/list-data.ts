// Shopping-list domain types mirroring the backend (camelCase) and the thin
// fetch helpers wired to /api/lists/*. No mock data — every call hits the BFF
// proxy which forwards to the real backend with the caller's token.

export interface ListSummary {
  id: string
  name: string
  itemCount: number
  createdAt: string
}

export interface ListItem {
  id: string
  freeText: string
  productId: string | null
  checked: boolean
  position: number
  updatedAt: string
}

export interface ListDetail {
  id: string
  name: string
  isActive: boolean
  createdAt: string
  completedAt: string | null
  items: ListItem[]
}

export interface ItemPatch {
  checked?: boolean
  freeText?: string
  productId?: string | null
}

// --- Optimizer (§6.5.3 split-route) result, mirrors core/domain/routeOptimizer ---

export type Confidence = 'high' | 'medium' | 'low'

export interface StoreLine {
  productId: string
  displayName: string
  expectedPrice: number
  observationCount: number
  lastObservedOn: string | null
  confidence: Confidence
}

export interface StoreSubList {
  merchantId: string
  name: string
  isPrimary: boolean
  subtotal: number
  lines: StoreLine[]
}

export interface OptimizationResult {
  optimized: boolean
  baseline: { merchantId: string; name: string; total: number } | null
  totalExpectedSaving: number
  stores: StoreSubList[]
  unresolvedItems: string[]
  reason: string | null
}

// Active-list cap by role (§10): STANDARD gets 3, everyone else 10. Mirrors the
// backend core/domain/shoppingList.ts so the UI can disable "New list" early.
export const STANDARD_ACTIVE_LISTS = 3
export const PREMIUM_ACTIVE_LISTS = 10

export const activeListLimit = (role: string | undefined): number =>
  role === 'STANDARD' || !role ? STANDARD_ACTIVE_LISTS : PREMIUM_ACTIVE_LISTS

// Optimizer is a Premium feature; the elevated operator roles get it too.
export const canOptimize = (role: string | undefined): boolean =>
  !!role && role !== 'STANDARD'

// A price observation older than this renders greyed with its age (§6.5.2).
export const STALE_OBSERVATION_DAYS = 60

async function jsonOrThrow(res: Response): Promise<unknown> {
  if (!res.ok) throw new Error(String(res.status))
  return res.json()
}

export async function fetchLists(): Promise<ListSummary[]> {
  const data = (await jsonOrThrow(
    await fetch('/api/lists', { cache: 'no-store' }),
  )) as { lists: ListSummary[] }
  return data.lists ?? []
}

export async function fetchListDetail(id: string): Promise<ListDetail> {
  return (await jsonOrThrow(
    await fetch(`/api/lists/${id}`, { cache: 'no-store' }),
  )) as ListDetail
}

export async function createList(name: string): Promise<string> {
  const data = (await jsonOrThrow(
    await fetch('/api/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }),
  )) as { id: string }
  return data.id
}

export async function addItem(
  listId: string,
  freeText: string,
  productId: string | null,
): Promise<string> {
  const data = (await jsonOrThrow(
    await fetch(`/api/lists/${listId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ freeText, productId }),
    }),
  )) as { id: string }
  return data.id
}

export async function patchItem(listId: string, itemId: string, patch: ItemPatch): Promise<void> {
  const res = await fetch(`/api/lists/${listId}/items/${itemId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(String(res.status))
}

export async function removeItem(listId: string, itemId: string): Promise<void> {
  const res = await fetch(`/api/lists/${listId}/items/${itemId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(String(res.status))
}

export async function completeList(listId: string): Promise<void> {
  const res = await fetch(`/api/lists/${listId}/complete`, { method: 'POST' })
  if (!res.ok) throw new Error(String(res.status))
}

export async function optimizeList(listId: string): Promise<OptimizationResult> {
  return (await jsonOrThrow(
    await fetch(`/api/lists/${listId}/optimize`, { method: 'POST' }),
  )) as OptimizationResult
}
