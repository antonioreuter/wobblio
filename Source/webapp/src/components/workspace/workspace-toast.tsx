'use client'

import { Check, RotateCw, Trash2 } from 'lucide-react'

export type ToastTone = 'success' | 'danger' | 'processing'
export interface ToastState {
  msg: string
  tone: ToastTone
}

interface WorkspaceToastProps {
  toast: ToastState | null
  onClose: () => void
}

export function WorkspaceToast({ toast, onClose }: WorkspaceToastProps) {
  if (!toast) return null
  const processing = toast.tone === 'processing'
  const Icon = processing ? RotateCw : toast.tone === 'danger' ? Trash2 : Check
  return (
    <div className={`toast toast--${toast.tone}`} role="status">
      <span className={`toast-icon ${processing ? 'spin' : ''}`}>
        <Icon size={17} />
      </span>
      <span className="toast-msg">{toast.msg}</span>
      {!processing && (
        <button type="button" className="toast-close" aria-label="Dismiss" onClick={onClose}>
          ✕
        </button>
      )}
    </div>
  )
}
