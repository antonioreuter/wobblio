'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

interface RightDrawerProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
}

export function RightDrawer({ open, onClose, title, children, className }: RightDrawerProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/20 transition-opacity dark:bg-black/50',
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer panel */}
      <aside
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-[480px] max-w-full flex-col border-l border-[#e2e8f0] bg-white shadow-xl transition-transform dark:border-[#334155] dark:bg-[#111827]',
          open ? 'translate-x-0' : 'translate-x-full',
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? 'Inspection drawer'}
      >
        {/* Drawer header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#e2e8f0] px-4 dark:border-[#334155]">
          {title && (
            <p className="text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">{title}</p>
          )}
          <button
            onClick={onClose}
            className="ml-auto rounded p-1.5 text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a] dark:text-[#94a3b8] dark:hover:bg-[#1e293b] dark:hover:text-[#f1f5f9]"
            aria-label="Close drawer"
          >
            <X size={16} strokeWidth={1.5} aria-hidden />
          </button>
        </div>

        {/* Drawer content */}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </aside>
    </>
  )
}
