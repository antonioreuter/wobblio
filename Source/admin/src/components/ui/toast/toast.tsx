'use client'

import { useEffect } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { cn } from '@/lib/cn'

type ToastVariant = 'success' | 'error' | 'warning' | 'info'

interface ToastProps {
  id: string
  message: string
  variant?: ToastVariant
  duration?: number
  onDismiss: (id: string) => void
}

const variantConfig: Record<
  ToastVariant,
  { icon: React.ReactNode; bg: string; text: string; border: string }
> = {
  success: {
    icon: <CheckCircle2 size={16} strokeWidth={1.5} />,
    bg: 'bg-success-soft',
    text: 'text-success',
    border: 'border-success/20',
  },
  error: {
    icon: <XCircle size={16} strokeWidth={1.5} />,
    bg: 'bg-danger-soft',
    text: 'text-danger',
    border: 'border-danger/20',
  },
  warning: {
    icon: <AlertTriangle size={16} strokeWidth={1.5} />,
    bg: 'bg-warning-soft',
    text: 'text-warning',
    border: 'border-warning/20',
  },
  info: {
    icon: <Info size={16} strokeWidth={1.5} />,
    bg: 'bg-brand-soft',
    text: 'text-brand',
    border: 'border-brand/20',
  },
}

export function Toast({ id, message, variant = 'info', duration = 4000, onDismiss }: ToastProps) {
  useEffect(() => {
    if (duration <= 0) return
    const timer = setTimeout(() => onDismiss(id), duration)
    return () => clearTimeout(timer)
  }, [id, duration, onDismiss])

  const { icon, bg, text, border } = variantConfig[variant]

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        'flex items-center gap-3 rounded-[12px] border px-4 py-3 shadow-lg',
        bg,
        text,
        border
      )}
      data-testid={`toast-${variant}`}
    >
      <span aria-hidden>{icon}</span>
      <p className="flex-1 text-sm font-medium">{message}</p>
      <button
        onClick={() => onDismiss(id)}
        className="ml-2 rounded hover:opacity-70"
        aria-label="Dismiss notification"
      >
        <X size={14} strokeWidth={2} aria-hidden />
      </button>
    </div>
  )
}
