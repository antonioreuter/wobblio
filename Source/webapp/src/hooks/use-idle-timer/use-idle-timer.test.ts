import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIdleTimer } from './use-idle-timer'

const IDLE = 10_000
const WARNING = 3_000

describe('useIdleTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  function setup(onTimeout = vi.fn()) {
    const view = renderHook(() =>
      useIdleTimer({ idleMs: IDLE, warningMs: WARNING, onTimeout }),
    )
    return { ...view, onTimeout }
  }

  it('shows the warning after the idle-minus-warning window', () => {
    const { result } = setup()
    expect(result.current.warning).toBe(false)

    act(() => {
      vi.advanceTimersByTime(IDLE - WARNING)
    })

    expect(result.current.warning).toBe(true)
    expect(result.current.secondsLeft).toBe(WARNING / 1000)
  })

  it('fires onTimeout when the countdown reaches zero', () => {
    const { result, onTimeout } = setup()

    act(() => {
      vi.advanceTimersByTime(IDLE)
    })

    expect(onTimeout).toHaveBeenCalledTimes(1)
    expect(result.current.warning).toBe(true)
  })

  it('resets the idle window on user activity before the warning', () => {
    const { result, onTimeout } = setup()

    act(() => {
      vi.advanceTimersByTime(IDLE - WARNING - 1000)
      window.dispatchEvent(new Event('keydown'))
    })
    act(() => {
      vi.advanceTimersByTime(IDLE - WARNING - 1000)
    })

    expect(result.current.warning).toBe(false)
    expect(onTimeout).not.toHaveBeenCalled()
  })

  it('stayActive dismisses the warning and restarts the idle window', () => {
    const { result, onTimeout } = setup()

    act(() => {
      vi.advanceTimersByTime(IDLE - WARNING)
    })
    expect(result.current.warning).toBe(true)

    act(() => {
      result.current.stayActive()
    })
    expect(result.current.warning).toBe(false)

    // Countdown was cancelled — no timeout fires after the original deadline.
    act(() => {
      vi.advanceTimersByTime(WARNING + 100)
    })
    expect(onTimeout).not.toHaveBeenCalled()
  })

  it('ignores activity once the warning is showing', () => {
    const { onTimeout } = setup()

    act(() => {
      vi.advanceTimersByTime(IDLE - WARNING)
    })
    act(() => {
      window.dispatchEvent(new Event('mousemove'))
      vi.advanceTimersByTime(WARNING)
    })

    expect(onTimeout).toHaveBeenCalledTimes(1)
  })
})
