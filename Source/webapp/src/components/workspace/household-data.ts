// Household domain types mirroring the backend HouseholdDetail/HouseholdMember
// DTOs (camelCase). Wired to /api/households/* — no mock data.

export interface HouseholdMember {
  userId: string
  email: string
  fullName: string
  isOwner: boolean
  uploadsThisWeek: number
}

export interface HouseholdPool {
  used: number
  cap: number
  remaining: number
}

export interface HouseholdDetail {
  id: string
  name: string
  ownerUserId: string
  members: HouseholdMember[]
  pool?: HouseholdPool
}

// The single invite a page session has generated. There is no list-invites
// endpoint, so revoke targets only the invite minted in this session.
export interface GeneratedInvite {
  inviteId: string
  token: string
  inviteUrl: string
  expiresAt: string
}

export const MAX_HOUSEHOLD_MEMBERS = 3

export const poolPercent = (pool: HouseholdPool | undefined): number =>
  pool && pool.cap > 0 ? Math.round((pool.used / pool.cap) * 100) : 0

// Two-letter initials for the avatar, preferring the display name and falling
// back to the email local part.
export function memberInitials(member: Pick<HouseholdMember, 'fullName' | 'email'>): string {
  const source = member.fullName.trim() || member.email.split('@')[0]
  const parts = source.split(/[\s._-]+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

// GET /api/households/mine → { household: HouseholdDetail | null } (no pool).
export async function fetchMine(): Promise<HouseholdDetail | null> {
  const res = await fetch('/api/households/mine', { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to load household (${res.status})`)
  const data = (await res.json()) as { household: HouseholdDetail | null }
  return data.household
}

// GET /api/households/:id → HouseholdDetail & { pool } (roster + weekly pool).
export async function fetchDetail(householdId: string): Promise<HouseholdDetail> {
  const res = await fetch(`/api/households/${householdId}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to load household (${res.status})`)
  return (await res.json()) as HouseholdDetail
}
