// Shopping-list domain types mirroring the backend (camelCase) and the thin
// fetch helpers wired to /api/lists/*. No mock data — every call hits the BFF
// proxy which forwards to the real backend with the caller's token.

export interface ListSummary {
  id: string
  name: string
  categoryId: string
  itemCount: number
  createdAt: string
}

export interface ListItem {
  id: string
  freeText: string
  productId: string | null
  checked: boolean
  quantity: number
  position: number
  updatedAt: string
}

export interface ListDetail {
  id: string
  name: string
  categoryId: string
  regionCode: string | null
  countryCode: string | null
  isActive: boolean
  createdAt: string
  completedAt: string | null
  items: ListItem[]
}

export interface ItemPatch {
  checked?: boolean
  freeText?: string
  productId?: string | null
  quantity?: number
}

// A list is locked to exactly one of these macro categories at creation (§10b) —
// item search only ever surfaces products under the chosen macro. Mirrors
// core/domain/shoppingList.ts.
export const SHOPPING_LIST_CATEGORY_IDS = ['cat-groceries', 'cat-personal-care'] as const
export type ShoppingListCategoryId = (typeof SHOPPING_LIST_CATEGORY_IDS)[number]

export const SHOPPING_LIST_CATEGORY_LABELS: Record<ShoppingListCategoryId, string> = {
  'cat-groceries': 'Groceries',
  'cat-personal-care': 'Drugstores',
}

// --- Optimizer (§6.5.3 split-route) result, mirrors core/domain/routeOptimizer ---

export type Confidence = 'high' | 'medium' | 'low'

export interface StoreLine {
  productId: string
  displayName: string
  expectedPrice: number
  quantity: number
  lineTotal: number
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

// Optimizer + region override are Premium features; the elevated operator roles get them too.
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

export async function createList(name: string, categoryId: string): Promise<string> {
  const data = (await jsonOrThrow(
    await fetch('/api/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, categoryId }),
    }),
  )) as { id: string }
  return data.id
}

export async function addItem(
  listId: string,
  freeText: string,
  productId: string | null,
  quantity = 1,
): Promise<string> {
  const data = (await jsonOrThrow(
    await fetch(`/api/lists/${listId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ freeText, productId, quantity }),
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

export async function optimizeList(listId: string, excludedMerchantIds: string[] = []): Promise<OptimizationResult> {
  return (await jsonOrThrow(
    await fetch(`/api/lists/${listId}/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ excludedMerchantIds }),
    }),
  )) as OptimizationResult
}

// Premium per-list region override (§10b/§10c). Both null clears it.
export async function setListRegion(listId: string, regionCode: string | null, countryCode: string | null): Promise<void> {
  const res = await fetch(`/api/lists/${listId}/region`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ regionCode, countryCode }),
  })
  if (!res.ok) throw new Error(String(res.status))
}

export interface IssuedListShare {
  shareId: string
  url: string
  expiresAt: string
}

export async function createListShare(listId: string): Promise<IssuedListShare> {
  return (await jsonOrThrow(
    await fetch(`/api/lists/${listId}/share`, { method: 'POST' }),
  )) as IssuedListShare
}

export async function revokeListShare(listId: string, shareId: string): Promise<void> {
  const res = await fetch(`/api/lists/${listId}/share/${shareId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(String(res.status))
}
