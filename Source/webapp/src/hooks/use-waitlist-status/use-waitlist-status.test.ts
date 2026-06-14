import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWaitlistStatus } from './use-waitlist-status'

describe('useWaitlistStatus', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://api.test')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('transitions from initial-unknown to fetch-resolved state', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ waitlistActive: false }),
      } as Response),
    )

    const { result } = renderHook(() => useWaitlistStatus())

    expect(result.current.waitlistActive).toBeNull()
    expect(result.current.loading).toBe(true)

    await act(async () => {})

    expect(result.current.waitlistActive).toBe(false)
    expect(result.current.loading).toBe(false)
  })

  it('falls back to false when the API base URL is missing', async () => {
    vi.unstubAllEnvs()
    const { result } = renderHook(() => useWaitlistStatus())

    expect(result.current.waitlistActive).toBe(false)
    expect(result.current.loading).toBe(false)
  })

  it('falls back to false when fetch rejects', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('network down')))

    const { result } = renderHook(() => useWaitlistStatus())
    await act(async () => {})

    expect(result.current.waitlistActive).toBe(false)
    expect(result.current.loading).toBe(false)
  })
})
