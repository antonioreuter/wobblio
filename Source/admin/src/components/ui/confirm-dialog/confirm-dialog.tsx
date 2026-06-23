'use client'

import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  body: string
  confirmLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

// Minimal accessible confirmation modal for high-impact admin actions (release,
// delete, bulk). Used wherever a spec requires a confirmation step.
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  destructive,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      data-testid="confirm-dialog"
    >
      <div className="w-full max-w-md rounded-[12px] border border-[#e2e8f0] bg-white p-6 shadow-lg">
        <h2 id="confirm-title" className="text-base font-semibold text-[#0f172a]">
          {title}
        </h2>
        <p className="mt-2 text-sm text-[#64748b]">{body}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel} data-testid="confirm-cancel">
            Cancel
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'primary'}
            size="sm"
            onClick={onConfirm}
            data-testid="confirm-accept"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
