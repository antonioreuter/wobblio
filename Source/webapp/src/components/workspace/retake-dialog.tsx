'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Camera, ImageUp } from 'lucide-react'

interface RetakeDialogProps {
  // The capture-gate tip (which issues, how to fix) — fix 11 · sub-spec 05.
  message: string
  onRetake: () => void
  onUploadAnyway: () => void
}

// Designed replacement for the native window.confirm capture-gate prompt (fix 11 · sub-spec 05).
// A soft stop, never a hard block: the recommended "Retake" is primary, "Upload anyway" the
// escape hatch. Nothing has left the device yet — no presign, no credit spent.
export function RetakeDialog({ message, onRetake, onUploadAnyway }: RetakeDialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onRetake() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onRetake])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="modal-overlay" onClick={onRetake} data-testid="retake-dialog">
      <div
        className="confirm-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          className="dialog-close"
          aria-label="Close"
          onClick={onRetake}
          data-testid="retake-cancel"
        >
          ✕
        </button>
        <div className="confirm-top">
          <div className="confirm-icon"><Camera size={20} /></div>
          <div className="confirm-head">
            <h3 className="confirm-title">This photo may be hard to read</h3>
            <p className="confirm-msg">{message}</p>
          </div>
        </div>
        <div className="confirm-actions">
          <button
            type="button"
            className="btn btn--outline"
            onClick={onUploadAnyway}
            data-testid="retake-upload-anyway"
          >
            <ImageUp size={15} /> Upload anyway
          </button>
          <button
            type="button"
            className="btn"
            onClick={onRetake}
            data-testid="retake-retake"
          >
            <Camera size={15} /> Retake photo
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
