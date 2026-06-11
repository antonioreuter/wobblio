'use client'

import Image from 'next/image'
import { AlertTriangle } from 'lucide-react'
import { ConfidenceBadge } from '@/components/ui/confidence-badge'
import { TagChipRow } from '@/components/ui/tag-chip-row'
import { Button } from '@/components/ui/button'
import { Money } from '@/components/ui/money'
import { cn } from '@/lib/cn'

type Confidence = 'confirmed' | 'auto' | 'low'

interface ParsedField {
  label: string
  value: string
  confidence: Confidence
  isAmount?: boolean
}

interface ReviewSideBySidePanelProps {
  receiptImageUrl?: string
  fields: ParsedField[]
  tags: string[]
  tagVocabulary?: string[]
  onAddTag?: (tag: string) => void
  onRemoveTag?: (tag: string) => void
  onFieldFix?: (field: ParsedField) => void
  onConfirm?: () => void
  isConfirming?: boolean
  className?: string
}

export function ReviewSideBySidePanel({
  receiptImageUrl,
  fields,
  tags,
  tagVocabulary = [],
  onAddTag,
  onRemoveTag,
  onFieldFix,
  onConfirm,
  isConfirming,
  className,
}: ReviewSideBySidePanelProps) {
  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Photo pane */}
      <div className="flex h-[45%] shrink-0 items-center justify-center bg-[#f1f5f9] dark:bg-[#0b0f19]">
        {receiptImageUrl ? (
          <Image
            src={receiptImageUrl}
            alt="Receipt"
            fill
            className="object-contain"
            data-testid="receipt-photo"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
            <span className="text-4xl">🧾</span>
            <p className="text-sm">No receipt image</p>
          </div>
        )}
      </div>

      {/* Parsed fields pane */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto divide-y divide-[#e2e8f0] dark:divide-[#334155]">
          {fields.map((field) => (
            <button
              key={field.label}
              className={cn(
                'flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors',
                field.confidence === 'low'
                  ? 'bg-[#fef3c7]/50 hover:bg-[#fef3c7] dark:bg-[#d97706]/10 dark:hover:bg-[#d97706]/20'
                  : 'hover:bg-[#f8fafc] dark:hover:bg-[#1e293b]'
              )}
              onClick={() => onFieldFix?.(field)}
              aria-label={
                field.confidence === 'low'
                  ? `Fix ${field.label}: ${field.value} (low confidence)`
                  : `${field.label}: ${field.value}`
              }
            >
              <div className="flex items-center gap-2">
                {field.confidence === 'low' && (
                  <AlertTriangle
                    size={14}
                    strokeWidth={1.5}
                    className="text-[#d97706]"
                    aria-hidden
                  />
                )}
                <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">{field.label}</span>
              </div>
              <div className="flex items-center gap-2">
                {field.isAmount ? (
                  <Money
                    amount={parseFloat(field.value.replace(/[^0-9.-]/g, ''))}
                    size="secondary"
                    className="text-[#0f172a] dark:text-[#f1f5f9]"
                  />
                ) : (
                  <span className="text-sm text-[#0f172a] dark:text-[#f1f5f9]">{field.value}</span>
                )}
                <ConfidenceBadge confidence={field.confidence} />
              </div>
            </button>
          ))}
        </div>

        {/* Tags + Confirm */}
        <div className="shrink-0 border-t border-[#e2e8f0] p-4 dark:border-[#334155]">
          <TagChipRow
            tags={tags}
            onAddTag={onAddTag}
            onRemoveTag={onRemoveTag}
            vocabulary={tagVocabulary}
            className="mb-3"
          />
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={onConfirm}
            disabled={isConfirming}
            data-testid="confirm-button"
          >
            {isConfirming ? 'Confirming…' : 'Confirm'}
          </Button>
        </div>
      </div>
    </div>
  )
}
