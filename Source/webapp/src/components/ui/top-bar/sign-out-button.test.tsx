import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { SignOutButton } from './sign-out-button'

// Logout must clear BOTH the NextAuth session cookie and the Cognito SSO cookie
// (federatedSignOut), not a plain signOut() — otherwise the surviving SSO cookie
// silently re-authenticates the user on the next /login visit, so they are never
// actually forced to sign in again.
const federatedSignOut = vi.fn()
vi.mock('@/lib/federated-sign-out', () => ({
  federatedSignOut: () => federatedSignOut(),
}))

describe('SignOutButton', () => {
  beforeEach(() => {
    cleanup()
    federatedSignOut.mockClear()
  })

  it('federated-signs-out (clears SSO) when sign-out is confirmed', () => {
    render(<SignOutButton />)
    fireEvent.click(screen.getByTestId('signout-button'))
    fireEvent.click(screen.getByTestId('signout-confirm'))
    expect(federatedSignOut).toHaveBeenCalledTimes(1)
  })

  it('does not sign out when the confirm dialog is cancelled', () => {
    render(<SignOutButton />)
    fireEvent.click(screen.getByTestId('signout-button'))
    fireEvent.click(screen.getByTestId('signout-confirm-cancel'))
    expect(federatedSignOut).not.toHaveBeenCalled()
  })
})
