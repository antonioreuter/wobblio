import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  memberInitials,
  poolPercent,
  fetchMine,
  fetchDetail,
  type HouseholdPool,
} from './household-data'

describe('poolPercent', () => {
  it('rounds used/cap to a percentage', () => {
    expect(poolPercent({ used: 5, cap: 20, remaining: 15, unlimited: false })).toBe(25)
    expect(poolPercent({ used: 3, cap: 20, remaining: 17, unlimited: false })).toBe(15)
  })

  it('returns 0 for an undefined pool, a zero cap, or an unlimited pool', () => {
    expect(poolPercent(undefined)).toBe(0)
    expect(poolPercent({ used: 1, cap: 0, remaining: 0, unlimited: false } as HouseholdPool)).toBe(0)
    expect(poolPercent({ used: 99, cap: null, remaining: null, unlimited: true })).toBe(0)
  })
})

describe('memberInitials', () => {
  it('uses the first letters of the first two name parts', () => {
    expect(memberInitials({ fullName: 'Anna Jansen', email: 'a@x.nl' })).toBe('AJ')
  })

  it('falls back to the email local part when there is no name', () => {
    expect(memberInitials({ fullName: '   ', email: 'bram@wobblio.nl' })).toBe('BR')
  })

  it('handles a single-word name', () => {
    expect(memberInitials({ fullName: 'Cees', email: 'c@x.nl' })).toBe('CE')
  })
})

describe('fetchMine', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('unwraps the household envelope', async () => {
    const household = { id: 'hh-1', name: 'Home', ownerUserId: 'u-1', members: [] }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ household }) }))
    await expect(fetchMine()).resolves.toEqual(household)
  })

  it('returns null when the user is solo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ household: null }) }))
    await expect(fetchMine()).resolves.toBeNull()
  })

  it('throws on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    await expect(fetchMine()).rejects.toThrow(/500/)
  })
})

describe('fetchDetail', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('requests the by-id endpoint and returns the detail with its pool', async () => {
    const detail = {
      id: 'hh-1',
      name: 'Home',
      ownerUserId: 'u-1',
      members: [],
      pool: { used: 2, cap: 20, remaining: 18 },
    }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => detail })
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchDetail('hh-1')).resolves.toEqual(detail)
    expect(fetchMock).toHaveBeenCalledWith('/api/households/hh-1', { cache: 'no-store' })
  })
})
