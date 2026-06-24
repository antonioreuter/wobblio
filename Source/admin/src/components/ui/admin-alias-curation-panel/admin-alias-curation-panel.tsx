'use client'

import { Check, X, Merge } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'

interface ProvisionalEntity {
  id: string
  name: string
  type: 'merchant' | 'product'
  observationCount: number
  suggestedCanonical?: string
}

interface AdminAliasCurationPanelProps {
  entities: ProvisionalEntity[]
  onApprove?: (id: string) => Promise<void>
  onMerge?: (id: string, canonical: string) => Promise<void>
  onReject?: (id: string) => Promise<void>
  className?: string
}

export function AdminAliasCurationPanel({
  entities,
  onApprove,
  onMerge,
  onReject,
  className,
}: AdminAliasCurationPanelProps) {
  return (
    <div className={cn('flex flex-col gap-3', className)} data-testid="admin-alias-curation-panel">
      <p className="text-sm font-semibold text-fg ">
        Alias Curation Queue ({entities.length} provisional)
      </p>

      {entities.length === 0 ? (
        <p className="text-sm text-muted ">Queue is empty.</p>
      ) : (
        <ul className="flex flex-col gap-2" role="list">
          {entities.map((entity) => (
            <li
              key={entity.id}
              className="rounded-[12px] border border-line bg-card p-3  "
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-fg ">
                      {entity.name}
                    </p>
                    <Badge variant="muted" className="text-xs">
                      {entity.type}
                    </Badge>
                    <Badge variant="warning" className="text-xs">
                      PROVISIONAL
                    </Badge>
                  </div>
                  <p className="text-xs text-muted ">
                    {entity.observationCount} observations
                  </p>
                  {entity.suggestedCanonical && (
                    <p className="text-xs text-muted ">
                      Suggested canonical:{' '}
                      <span className="font-medium text-fg ">
                        {entity.suggestedCanonical}
                      </span>
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-2 flex items-center gap-2">
                {onApprove && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onApprove(entity.id)}
                  >
                    <Check size={12} strokeWidth={1.5} />
                    Approve
                  </Button>
                )}
                {onMerge && entity.suggestedCanonical && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onMerge(entity.id, entity.suggestedCanonical!)}
                  >
                    <Merge size={12} strokeWidth={1.5} />
                    Merge
                  </Button>
                )}
                {onReject && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onReject(entity.id)}
                  >
                    <X size={12} strokeWidth={1.5} />
                    Reject
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
