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
    bg: 'bg-[#dcfce7]',
    text: 'text-[#16a34a]',
    border: 'border-[#16a34a]/20',
  },
  error: {
    icon: <XCircle size={16} strokeWidth={1.5} />,
    bg: 'bg-[#fee2e2]',
    text: 'text-[#dc2626]',
    border: 'border-[#dc2626]/20',
  },
  warning: {
    icon: <AlertTriangle size={16} strokeWidth={1.5} />,
    bg: 'bg-[#fef3c7]',
    text: 'text-[#d97706]',
    border: 'border-[#d97706]/20',
  },
  info: {
    icon: <Info size={16} strokeWidth={1.5} />,
    bg: 'bg-[#ccfbf1]',
    text: 'text-[#0d9488]',
    border: 'border-[#0d9488]/20',
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
