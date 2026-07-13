'use client'

// 09/04 comparison-set client data layer. Cross-merchant comparability is a user assertion,
// tenant-scoped (RLS on the backend). All calls proxy through the BFF (/api/me/comparison-sets).

export type ComparisonMemberSource = 'USER' | 'SPLIT_SEED'
export type SizeSource = 'RECEIPT' | 'USER' | null

export interface ComparisonSetMember {
  id: string
  productId: string
  displayName: string
  brand: string | null
  merchantId: string | null
  merchantName: string | null
  source: ComparisonMemberSource
  sizeEquivalent: boolean
  size: { sizeText: string | null; sizeSource: SizeSource }
  addedAt: string
}

export interface ComparisonSet {
  id: string
  name: string | null
  createdAt: string
  members: ComparisonSetMember[]
}

const jsonHeaders = { 'Content-Type': 'application/json' }

export async function fetchComparisonSets(): Promise<ComparisonSet[]> {
  const res = await fetch('/api/me/comparison-sets', { cache: 'no-store' })
  if (!res.ok) return []
  const data = (await res.json()) as { sets: ComparisonSet[] }
  return data.sets ?? []
}

export async function createComparisonSet(name: string | null): Promise<string | null> {
  const res = await fetch('/api/me/comparison-sets', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ name }) })
  if (!res.ok) return null
  return ((await res.json()) as { id: string }).id
}

export async function renameComparisonSet(setId: string, name: string | null): Promise<boolean> {
  const res = await fetch(`/api/me/comparison-sets/${setId}`, { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify({ name }) })
  return res.ok
}

export async function deleteComparisonSet(setId: string): Promise<boolean> {
  const res = await fetch(`/api/me/comparison-sets/${setId}`, { method: 'DELETE' })
  return res.ok
}

// "compare with…" → the one-question flow: sizeEquivalent = true (Yes, same size/pack, rankable)
// or false (Not sure → watch-only). Returns false on the 5-member cap / duplicate (409/400).
export async function addComparisonMember(setId: string, productId: string, sizeEquivalent: boolean): Promise<boolean> {
  const res = await fetch(`/api/me/comparison-sets/${setId}/members`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ productId, sizeEquivalent }) })
  return res.ok
}

export async function setMemberSizeEquivalent(setId: string, memberId: string, sizeEquivalent: boolean): Promise<boolean> {
  const res = await fetch(`/api/me/comparison-sets/${setId}/members/${memberId}`, { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify({ sizeEquivalent }) })
  return res.ok
}

export async function removeComparisonMember(setId: string, memberId: string): Promise<boolean> {
  const res = await fetch(`/api/me/comparison-sets/${setId}/members/${memberId}`, { method: 'DELETE' })
  return res.ok
}
