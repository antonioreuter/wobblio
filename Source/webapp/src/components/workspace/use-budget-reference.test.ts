import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useBudgetReference } from './use-budget-reference'

// The owner is matched by email (session.user.email), never by id: session.user.id
// is the Cognito sub while household.ownerUserId is the DB app_user UUID, so an
// id comparison always fails and hides the HOUSEHOLD/MEMBER budget scopes.
const OWNER_EMAIL = 'owner@wobblio.nl'
const OWNER_DB_ID = 'db-uuid-owner'

const household = {
  ownerUserId: OWNER_DB_ID,
  members: [
    { userId: OWNER_DB_ID, fullName: 'Anna Jansen', email: OWNER_EMAIL, isOwner: true },
    { userId: 'db-uuid-member', fullName: 'Bram', email: 'bram@wobblio.nl', isOwner: false },
  ],
}

function mockFetch(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const body = url.includes('/api/households/mine') ? { household } : { categories: [] }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useBudgetReference — isHouseholdOwner', () => {
  it('recognises the owner by email even though session id ≠ DB owner id', async () => {
    mockFetch()
    // session.user.email is the owner's email; a Cognito-sub id would never match.
    const { result } = renderHook(() => useBudgetReference(true, OWNER_EMAIL))
    await waitFor(() => expect(result.current.isHouseholdOwner).toBe(true))
  })

  it('does not treat a non-owner member as the owner', async () => {
    mockFetch()
    const { result } = renderHook(() => useBudgetReference(true, 'bram@wobblio.nl'))
    await waitFor(() => expect(result.current.members).toHaveLength(2))
    expect(result.current.isHouseholdOwner).toBe(false)
  })

  it('is false for a solo user (no household)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        const body = url.includes('/api/households/mine') ? { household: null } : { categories: [] }
        return Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
      }),
    )
    const { result } = renderHook(() => useBudgetReference(true, OWNER_EMAIL))
    await waitFor(() => expect(result.current.categories).toEqual([]))
    expect(result.current.isHouseholdOwner).toBe(false)
  })
})
