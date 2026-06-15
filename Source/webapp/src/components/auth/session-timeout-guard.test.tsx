import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { SessionTimeoutGuard } from './session-timeout-guard'

const federatedSignOut = vi.fn()
const update = vi.fn()
let sessionData: { error?: string } | null = { error: undefined }

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: sessionData, update }),
}))

vi.mock('@/lib/federated-sign-out', () => ({
  federatedSignOut: (...args: unknown[]) => federatedSignOut(...args),
}))

// Control the idle lifecycle directly so we can drive each branch.
const idleState = {
  warning: false,
  secondsLeft: 120,
  stayActive: vi.fn(),
  onTimeout: undefined as undefined | (() => void),
}

vi.mock('@/hooks/use-idle-timer/use-idle-timer', () => ({
  useIdleTimer: (opts: { onTimeout: () => void }) => {
    idleState.onTimeout = opts.onTimeout
    return {
      warning: idleState.warning,
      secondsLeft: idleState.secondsLeft,
      stayActive: idleState.stayActive,
      reset: vi.fn(),
    }
  },
}))

describe('SessionTimeoutGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionData = { error: undefined }
    idleState.warning = false
    idleState.secondsLeft = 120
    cleanup()
  })

  it('renders nothing while the session is active', () => {
    render(<SessionTimeoutGuard />)
    expect(screen.queryByTestId('session-timeout-dialog')).toBeNull()
  })

  it('shows the warning dialog when idle', () => {
    idleState.warning = true
    render(<SessionTimeoutGuard />)
    expect(screen.getByTestId('session-timeout-dialog')).toBeInTheDocument()
  })

  it('refreshes the session and stays active on "Stay logged in"', () => {
    idleState.warning = true
    render(<SessionTimeoutGuard />)

    fireEvent.click(screen.getByTestId('session-timeout-stay'))

    expect(update).toHaveBeenCalledTimes(1)
    expect(idleState.stayActive).toHaveBeenCalledTimes(1)
    expect(federatedSignOut).not.toHaveBeenCalled()
  })

  it('signs out (federated) on "Log out now"', () => {
    idleState.warning = true
    render(<SessionTimeoutGuard />)

    fireEvent.click(screen.getByTestId('session-timeout-logout'))

    expect(federatedSignOut).toHaveBeenCalledTimes(1)
  })

  it('signs out (federated) when the idle timeout fires', () => {
    render(<SessionTimeoutGuard />)
    idleState.onTimeout?.()
    expect(federatedSignOut).toHaveBeenCalledTimes(1)
  })

  it('signs out when the token refresh has failed', () => {
    sessionData = { error: 'RefreshAccessTokenError' }
    render(<SessionTimeoutGuard />)
    expect(federatedSignOut).toHaveBeenCalledTimes(1)
  })
})
