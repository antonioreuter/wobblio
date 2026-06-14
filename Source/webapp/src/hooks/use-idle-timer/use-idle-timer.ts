import { useCallback, useEffect, useRef, useState } from 'react'

interface UseIdleTimerOptions {
  idleMs: number
  warningMs: number
  onTimeout: () => void
}

interface UseIdleTimerResult {
  warning: boolean
  secondsLeft: number
  stayActive: () => void
  reset: () => void
}

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const
const ACTIVITY_THROTTLE_MS = 1000
const SYNC_CHANNEL = 'wobblio-session-activity'

// Tracks user activity and drives the idle-logout lifecycle:
//   active -> (idle for idleMs - warningMs) -> warning countdown -> (warningMs) -> timeout
// Any activity while not in the warning state resets the timers. Activity is
// synced across tabs so the warning does not pop in a background tab while the
// user works in another. onTimeout fires once when the countdown reaches zero.
export function useIdleTimer({
  idleMs,
  warningMs,
  onTimeout,
}: UseIdleTimerOptions): UseIdleTimerResult {
  const [warning, setWarning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(warningMs / 1000))

  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastActivity = useRef(0)
  const channel = useRef<BroadcastChannel | null>(null)
  const onTimeoutRef = useRef(onTimeout)
  onTimeoutRef.current = onTimeout
  // Read inside event closures so the listener effect never re-subscribes
  // (re-subscribing would clear an in-flight countdown).
  const warningRef = useRef(false)
  warningRef.current = warning

  const clearTimers = useCallback(() => {
    if (warnTimer.current) clearTimeout(warnTimer.current)
    if (countdownTimer.current) clearInterval(countdownTimer.current)
    warnTimer.current = null
    countdownTimer.current = null
  }, [])

  const startCountdown = useCallback(() => {
    setWarning(true)
    const deadline = Date.now() + warningMs
    setSecondsLeft(Math.ceil(warningMs / 1000))
    countdownTimer.current = setInterval(() => {
      const remaining = deadline - Date.now()
      if (remaining <= 0) {
        clearTimers()
        onTimeoutRef.current()
        return
      }
      setSecondsLeft(Math.ceil(remaining / 1000))
    }, 1000)
  }, [warningMs, clearTimers])

  const reset = useCallback(() => {
    clearTimers()
    setWarning(false)
    setSecondsLeft(Math.ceil(warningMs / 1000))
    warnTimer.current = setTimeout(startCountdown, idleMs - warningMs)
  }, [clearTimers, idleMs, warningMs, startCountdown])

  // "Stay logged in" — reset locally and tell other tabs to reset too.
  const stayActive = useCallback(() => {
    reset()
    channel.current?.postMessage('stay')
  }, [reset])

  useEffect(() => {
    channel.current =
      typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(SYNC_CHANNEL) : null

    const onLocalActivity = () => {
      // Ignore activity once the warning is showing — only an explicit choice
      // dismisses it, so we don't silently swallow an imminent logout.
      if (warningRef.current) return
      const now = Date.now()
      if (now - lastActivity.current < ACTIVITY_THROTTLE_MS) return
      lastActivity.current = now
      reset()
      channel.current?.postMessage('activity')
    }

    if (channel.current) {
      channel.current.onmessage = (e) => {
        if ((e.data === 'activity' || e.data === 'stay') && !warningRef.current) reset()
      }
    }

    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, onLocalActivity, { passive: true }),
    )
    reset()

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, onLocalActivity))
      clearTimers()
      channel.current?.close()
      channel.current = null
    }
    // reset/clearTimers are stable; warning state is read via warningRef.
  }, [reset, clearTimers])

  return { warning, secondsLeft, stayActive, reset }
}
