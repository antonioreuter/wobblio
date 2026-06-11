import { ReviewSideBySidePanel } from '@/components/ui/review-side-by-side-panel'
import { cn } from '@/lib/cn'

type Confidence = 'confirmed' | 'auto' | 'low'

interface ParsedField {
  label: string
  value: string
  confidence: Confidence
  isAmount?: boolean
}

interface ParseReviewScreenProps {
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

export function ParseReviewScreen({
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
}: ParseReviewScreenProps) {
  return (
    <div
      className={cn('h-full min-h-screen', className)}
      data-testid="parse-review-screen"
    >
      <ReviewSideBySidePanel
        receiptImageUrl={receiptImageUrl}
        fields={fields}
        tags={tags}
        tagVocabulary={tagVocabulary}
        onAddTag={onAddTag}
        onRemoveTag={onRemoveTag}
        onFieldFix={onFieldFix}
        onConfirm={onConfirm}
        isConfirming={isConfirming}
        className="h-full"
      />
    </div>
  )
}
