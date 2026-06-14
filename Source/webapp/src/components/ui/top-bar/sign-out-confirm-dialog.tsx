'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { LogOut } from 'lucide-react'

interface SignOutConfirmDialogProps {
  onConfirm: () => void
  onCancel: () => void
}

export function SignOutConfirmDialog({ onConfirm, onCancel }: SignOutConfirmDialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="modal-overlay" onClick={onCancel} data-testid="signout-confirm-dialog">
      <div
        className="confirm-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="signout-confirm-title"
      >
        <button
          type="button"
          className="dialog-close"
          aria-label="Close"
          onClick={onCancel}
          data-testid="signout-confirm-cancel"
        >
          ✕
        </button>
        <div className="confirm-top">
          <div className="confirm-icon confirm-icon--neutral"><LogOut size={20} /></div>
          <div className="confirm-head">
            <h3 className="confirm-title" id="signout-confirm-title">Sign out?</h3>
            <p className="confirm-msg">You&apos;ll be returned to the landing page and need to sign in again to access your account.</p>
          </div>
        </div>
        <div className="confirm-actions">
          <button type="button" className="btn btn--outline" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={onConfirm}
            data-testid="signout-confirm"
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
