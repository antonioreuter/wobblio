'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Trash2, Eye, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

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

export default function DlqPage() {
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#0f172a]">Dead Letter Queue</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={load} data-testid="dlq-refresh">
            <RefreshCw size={14} strokeWidth={1.5} /> Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={messages.length === 0}
            onClick={() => setBulk('replay-all')}
            data-testid="dlq-replay-all"
          >
            Replay all
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={messages.length === 0}
            onClick={() => setBulk('delete-all')}
            data-testid="dlq-delete-all"
          >
            Delete all
          </Button>
        </div>
      </div>

      {error && <p className="text-xs text-[#dc2626]" role="alert">{error}</p>}

      {messages.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-[#e2e8f0] bg-white p-16 text-center text-sm text-[#64748b]">
          No messages in the DLQ.
        </div>
      ) : (
        <ul className="flex flex-col gap-2" role="list" data-testid="dlq-list">
          {messages.map((m) => (
            <li
              key={m.messageId}
              className="rounded-[12px] border border-[#e2e8f0] bg-white p-3"
              data-testid="dlq-row"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <p className="font-mono text-xs text-[#64748b]">{m.messageId}</p>
                  <p className="font-mono text-xs text-[#0f172a]">{m.preview}</p>
                  <p className="text-xs text-[#64748b]">
                    tenant {m.tenantId ?? '—'} · {m.approximateReceiveCount} attempts ·{' '}
                    {m.firstFailedAt ? new Date(m.firstFailedAt).toLocaleString() : 'unknown time'}
                  </p>
                </div>
                {m.logsUrl && (
                  <a
                    href={m.logsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-[#0d9488] hover:underline"
                  >
                    Logs <ExternalLink size={12} strokeWidth={1.5} />
                  </a>
                )}
              </div>

              {inspecting === m.messageId && (
                <pre className="mt-2 overflow-x-auto rounded bg-[#f8fafc] p-2 font-mono text-xs text-[#0f172a]">
                  {m.body}
                </pre>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setInspecting(inspecting === m.messageId ? null : m.messageId)}
                  data-testid="dlq-inspect"
                >
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
    </div>
  )
}
