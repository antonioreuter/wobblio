'use client'

import { useState } from 'react'
import { RefreshCw, X, Eye, Copy, Check } from 'lucide-react'
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
  const [copied, setCopied] = useState<string | null>(null)

  async function handleAction(id: string, action: (id: string) => Promise<void>) {
    setLoading((l) => ({ ...l, [id]: true }))
    try {
      await action(id)
    } finally {
      setLoading((l) => ({ ...l, [id]: false }))
    }
  }

  async function handleCopy(text: string, copyType: string) {
    await navigator.clipboard.writeText(text)
    setCopied(copyType)
    setTimeout(() => setCopied(null), 2000)
  }

  function formatJson(obj: Record<string, unknown>): string {
    return JSON.stringify(obj, null, 2)
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
                <div className="flex flex-col gap-1 flex-1">
                  <p className="font-mono text-xs text-muted ">{msg.id}</p>
                  <p className="text-xs text-muted ">
                    {msg.timestamp} · {msg.retryCount} retries
                  </p>
                </div>
                <ConfidenceBadge confidence="low" />
              </div>

              <div className="mt-3 space-y-3">
                <div className="rounded-lg bg-bg p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-xs font-semibold text-fg">Log Message</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => handleCopy(msg.error, `error-${msg.id}`)}
                      title="Copy log message"
                    >
                      {copied === `error-${msg.id}` ? (
                        <Check size={14} className="text-green-600" strokeWidth={2} />
                      ) : (
                        <Copy size={14} strokeWidth={1.5} />
                      )}
                    </Button>
                  </div>
                  <p className="text-sm font-mono text-danger break-words whitespace-pre-wrap">
                    {msg.error}
                  </p>
                </div>

                {inspecting === msg.id && (
                  <div className="rounded-lg bg-bg p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-xs font-semibold text-fg">Payload</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => handleCopy(formatJson(msg.payload), `payload-${msg.id}`)}
                        title="Copy payload JSON"
                      >
                        {copied === `payload-${msg.id}` ? (
                          <Check size={14} className="text-green-600" strokeWidth={2} />
                        ) : (
                          <Copy size={14} strokeWidth={1.5} />
                        )}
                      </Button>
                    </div>
                    <pre className="overflow-x-auto font-mono text-xs text-fg leading-relaxed">
                      {formatJson(msg.payload)}
                    </pre>
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setInspecting(inspecting === msg.id ? null : msg.id)}
                >
                  <Eye size={12} strokeWidth={1.5} />
                  {inspecting === msg.id ? 'Hide Details' : 'View Details'}
                </Button>
                {onReplay && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loading[msg.id]}
                    onClick={() => handleAction(msg.id, onReplay)}
                  >
                    <RefreshCw size={12} strokeWidth={1.5} />
                    Retry
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
                    Discard
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
