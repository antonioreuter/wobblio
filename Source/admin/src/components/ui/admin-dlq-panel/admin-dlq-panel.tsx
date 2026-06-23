'use client'

import { useState } from 'react'
import { RefreshCw, X, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfidenceBadge } from '@/components/ui/confidence-badge'
import { cn } from '@/lib/cn'

interface DlqMessage {
  id: string
  timestamp: string
  error: string
  payload: Record<string, unknown>
  retryCount: number
}

interface AdminDlqPanelProps {
  messages: DlqMessage[]
  onReplay?: (id: string) => Promise<void>
  onDeadLetter?: (id: string) => Promise<void>
  className?: string
}

export function AdminDlqPanel({
  messages,
  onReplay,
  onDeadLetter,
  className,
}: AdminDlqPanelProps) {
  const [inspecting, setInspecting] = useState<string | null>(null)
  const [loading, setLoading] = useState<Record<string, boolean>>({})

  async function handleAction(id: string, action: (id: string) => Promise<void>) {
    setLoading((l) => ({ ...l, [id]: true }))
    try {
      await action(id)
    } finally {
      setLoading((l) => ({ ...l, [id]: false }))
    }
  }

  return (
    <div className={cn('flex flex-col gap-3', className)} data-testid="admin-dlq-panel">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-fg ">
          Dead Letter Queue ({messages.length})
        </p>
      </div>

      {messages.length === 0 ? (
        <p className="text-sm text-muted ">No messages in DLQ.</p>
      ) : (
        <ul className="flex flex-col gap-2" role="list">
          {messages.map((msg) => (
            <li
              key={msg.id}
              className="rounded-[12px] border border-line bg-card p-3  "
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <p className="font-mono text-xs text-muted ">{msg.id}</p>
                  <p className="text-sm text-danger">{msg.error}</p>
                  <p className="text-xs text-muted ">
                    {msg.timestamp} · {msg.retryCount} retries
                  </p>
                </div>
                <ConfidenceBadge confidence="low" />
              </div>

              {inspecting === msg.id && (
                <pre className="mt-2 overflow-x-auto rounded bg-bg p-2 font-mono text-xs text-fg  ">
                  {JSON.stringify(msg.payload, null, 2)}
                </pre>
              )}

              <div className="mt-2 flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setInspecting(inspecting === msg.id ? null : msg.id)}
                >
                  <Eye size={12} strokeWidth={1.5} />
                  {inspecting === msg.id ? 'Hide' : 'Inspect'}
                </Button>
                {onReplay && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loading[msg.id]}
                    onClick={() => handleAction(msg.id, onReplay)}
                  >
                    <RefreshCw size={12} strokeWidth={1.5} />
                    Replay
                  </Button>
                )}
                {onDeadLetter && (
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={loading[msg.id]}
                    onClick={() => handleAction(msg.id, onDeadLetter)}
                  >
                    <X size={12} strokeWidth={1.5} />
                    Dead-letter
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
