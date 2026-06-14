'use client'

import { createPortal } from 'react-dom'
import { Clock } from 'lucide-react'

interface SessionTimeoutDialogProps {
  secondsLeft: number
  onStay: () => void
  onLogout: () => void
}

function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds)
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// Idle-warning modal. Mirrors SignOutConfirmDialog's portal/markup so it picks
// up the existing .modal-overlay / .confirm-card styling. No overlay-click or
// Escape dismissal here: ignoring the prompt must let the countdown run out.
export function SessionTimeoutDialog({
  secondsLeft,
  onStay,
  onLogout,
}: SessionTimeoutDialogProps) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="modal-overlay" data-testid="session-timeout-dialog">
      <div
        className="confirm-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-timeout-title"
        aria-describedby="session-timeout-msg"
      >
        <div className="confirm-top">
          <div className="confirm-icon confirm-icon--neutral"><Clock size={20} /></div>
          <div className="confirm-head">
            <h3 className="confirm-title" id="session-timeout-title">Still there?</h3>
            <p className="confirm-msg" id="session-timeout-msg">
              For your security, you&apos;ll be signed out in{' '}
              <strong data-testid="session-timeout-countdown">
                {formatCountdown(secondsLeft)}
              </strong>{' '}
              due to inactivity.
            </p>
          </div>
        </div>
        <div className="confirm-actions">
          <button
            type="button"
            className="btn btn--outline"
            onClick={onLogout}
            data-testid="session-timeout-logout"
          >
            Log out now
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={onStay}
            data-testid="session-timeout-stay"
            autoFocus
          >
            Stay logged in
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
