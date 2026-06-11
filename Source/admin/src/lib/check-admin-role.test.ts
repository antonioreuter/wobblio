import { describe, it, expect } from 'vitest'
import { checkAdminRole } from './check-admin-role'

describe('checkAdminRole', () => {
  it('denies when role cookie is missing', () => {
    expect(checkAdminRole(undefined)).toBe(false)
  })

  it('denies when role is present but not ADMIN', () => {
    expect(checkAdminRole('USER')).toBe(false)
  })

  it('allows when role is exactly ADMIN', () => {
    expect(checkAdminRole('ADMIN')).toBe(true)
  })

  it('denies lowercase admin — role values are always uppercase from Cognito', () => {
    expect(checkAdminRole('admin')).toBe(false)
  })
})
