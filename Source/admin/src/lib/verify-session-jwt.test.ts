import { describe, it, expect } from 'vitest'
import { verifySessionJwt } from './verify-session-jwt'

const FUTURE = new Date(Date.now() + 60_000).toISOString()
const PAST = new Date(Date.now() - 60_000).toISOString()
const valid = { user: { id: 'u-1', email: 'a@wobblio.nl', role: 'ADMIN' }, expires: FUTURE }

describe('verifySessionJwt', () => {
  it('returns role/sub/email for a valid session', () => {
    expect(verifySessionJwt(valid)).toEqual({ role: 'ADMIN', sub: 'u-1', email: 'a@wobblio.nl' })
  })

  it('returns null for a null/empty session', () => {
    expect(verifySessionJwt(null)).toBeNull()
    expect(verifySessionJwt({})).toBeNull()
  })

  it('returns null when the role claim is missing', () => {
    expect(verifySessionJwt({ user: { id: 'u-1', email: 'a@wobblio.nl' }, expires: FUTURE })).toBeNull()
  })

  it('returns null when sub or email is missing', () => {
    expect(verifySessionJwt({ user: { email: 'a@wobblio.nl', role: 'ADMIN' } })).toBeNull()
    expect(verifySessionJwt({ user: { id: 'u-1', role: 'ADMIN' } })).toBeNull()
  })

  it('returns null for an expired session', () => {
    expect(verifySessionJwt({ ...valid, expires: PAST })).toBeNull()
  })

  it('returns null when the session carries a refresh error', () => {
    expect(verifySessionJwt({ ...valid, error: 'RefreshAccessTokenError' })).toBeNull()
  })

  it('extracts a non-admin role (gate is checkAdminRole, not this)', () => {
    expect(verifySessionJwt({ ...valid, user: { ...valid.user, role: 'STANDARD' } })?.role).toBe(
      'STANDARD',
    )
  })
})
