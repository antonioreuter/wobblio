import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { ForceSignOut } from './force-sign-out'

const federatedSignOut = vi.fn()

vi.mock('@/lib/federated-sign-out', () => ({
  federatedSignOut: (...args: unknown[]) => federatedSignOut(...args),
}))

describe('ForceSignOut', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cleanup()
  })

  it('triggers a federated sign-out on mount and shows a status message', async () => {
    render(<ForceSignOut />)

    expect(screen.getByTestId('force-sign-out')).toBeInTheDocument()
    await waitFor(() => expect(federatedSignOut).toHaveBeenCalledTimes(1))
  })
})
