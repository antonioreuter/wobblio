'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Trash2, Eye, ExternalLink, Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ConsoleSection } from '@/components/ui/console-section'

interface DlqMessage {
  messageId: string
  receiptHandle: string
  body: string
  preview: string
  tenantId: string | null
  invoiceId: string | null
  s3Key: string | null
  approximateReceiveCount: number
  firstFailedAt: string | null
  logsUrl: string | null
}

type Bulk = 'replay-all' | 'delete-all' | null

export function DlqSection() {
  const [messages, setMessages] = useState<DlqMessage[]>([])
  const [inspecting, setInspecting] = useState<string | null>(null)
  const [bulk, setBulk] = useState<Bulk>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/dlq/messages')
    if (!res.ok) {
      setError('Failed to load DLQ')
      return
    }
    const data = await res.json()
    setMessages(data.messages ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function replay(m: DlqMessage) {
    await fetch(`/api/admin/dlq/messages/${m.messageId}/replay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiptHandle: m.receiptHandle, body: m.body }),
    })
    await load()
  }

  async function remove(m: DlqMessage) {
    await fetch(`/api/admin/dlq/messages/${m.messageId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiptHandle: m.receiptHandle }),
    })
    await load()
  }

  async function runBulk() {
    const action = bulk
    setBulk(null)
    if (!action) return
    const path = action === 'replay-all' ? '/api/admin/dlq/replay-all' : '/api/admin/dlq/delete-all'
    await fetch(path, {
      method: action === 'replay-all' ? 'POST' : 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 100 }),
    })
    await load()
  }

  return (
    <ConsoleSection
      id="dlq"
      icon={Inbox}
      title="Dead Letter Queue"
      description="Ingestions that failed every retry. Inspect the payload, replay onto the queue, or discard."
      headerAside={
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={load} data-testid="dlq-refresh">
            <RefreshCw size={14} strokeWidth={1.5} /> Refresh
          </Button>
          <Button variant="outline" size="sm" disabled={messages.length === 0} onClick={() => setBulk('replay-all')} data-testid="dlq-replay-all">
            Replay all
          </Button>
          <Button variant="destructive" size="sm" disabled={messages.length === 0} onClick={() => setBulk('delete-all')} data-testid="dlq-delete-all">
            Delete all
          </Button>
        </div>
      }
    >
      {error && <p className="text-xs text-danger" role="alert">{error}</p>}

      {messages.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-line bg-card p-12 text-center text-sm text-muted">
          No messages in the DLQ.
        </div>
      ) : (
        <ul className="flex flex-col gap-2" role="list" data-testid="dlq-list">
          {messages.map((m) => (
            <li key={m.messageId} className="rounded-[12px] border border-line bg-card p-3" data-testid="dlq-row">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <p className="font-mono text-xs text-muted">{m.messageId}</p>
                  <p className="font-mono text-xs text-fg">{m.preview}</p>
                  <p className="text-xs text-muted">
                    tenant {m.tenantId ?? '—'} · {m.approximateReceiveCount} attempts ·{' '}
                    {m.firstFailedAt ? new Date(m.firstFailedAt).toLocaleString() : 'unknown time'}
                  </p>
                </div>
                {m.logsUrl && (
                  <a href={m.logsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-brand hover:underline">
                    Logs <ExternalLink size={12} strokeWidth={1.5} />
                  </a>
                )}
              </div>

              {inspecting === m.messageId && (
                <pre className="mt-2 overflow-x-auto rounded bg-bg p-2 font-mono text-xs text-fg">{m.body}</pre>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setInspecting(inspecting === m.messageId ? null : m.messageId)} data-testid="dlq-inspect">
                  <Eye size={12} strokeWidth={1.5} /> {inspecting === m.messageId ? 'Hide' : 'Inspect'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => replay(m)} data-testid="dlq-replay">
                  <RefreshCw size={12} strokeWidth={1.5} /> Replay
                </Button>
                <Button variant="destructive" size="sm" onClick={() => remove(m)} data-testid="dlq-delete">
                  <Trash2 size={12} strokeWidth={1.5} /> Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={bulk !== null}
        title={bulk === 'replay-all' ? 'Replay all DLQ messages?' : 'Delete all DLQ messages?'}
        body={
          bulk === 'replay-all'
            ? 'Sends up to 100 messages back to the ingestion queue and removes them from the DLQ.'
            : 'Permanently deletes up to 100 messages from the DLQ. This cannot be undone.'
        }
        confirmLabel={bulk === 'replay-all' ? 'Replay all' : 'Delete all'}
        destructive={bulk === 'delete-all'}
        onConfirm={runBulk}
        onCancel={() => setBulk(null)}
      />
    </ConsoleSection>
  )
}
