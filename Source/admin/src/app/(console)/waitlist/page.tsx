'use client'

import { useCallback, useEffect, useState } from 'react'
import { Users, ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface Overview {
  freeUsers: number
  cap: number
  queueSize: number
}

export default function WaitlistPage() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [count, setCount] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/waitlist')
    if (!res.ok) {
      setError('Failed to load waitlist')
      return
    }
    setOverview(await res.json())
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function release() {
    setConfirming(false)
    setError(null)
    setMessage(null)
    const res = await fetch('/api/admin/waitlist/release', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: Number(count) }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.message ?? 'Release failed')
      return
    }
    setMessage(`Released ${data.released} user(s).`)
    setCount('')
    await load()
  }

  const n = Number(count)
  const canRelease = Number.isInteger(n) && n > 0

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-[#0f172a]">Waitlist</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" data-testid="waitlist-overview">
        <Stat label="Free users" value={overview?.freeUsers} />
        <Stat label="Cap" value={overview?.cap} />
        <Stat label="Queue size" value={overview?.queueSize} icon={<Users size={16} strokeWidth={1.5} />} />
      </div>

      <div className="flex flex-col gap-3 rounded-[12px] border border-[#e2e8f0] bg-white p-4">
        <p className="text-sm font-semibold text-[#0f172a]">Release users (FIFO)</p>
        <div className="flex items-end gap-3">
          <div className="w-32">
            <Input
              label="Count"
              type="number"
              min={1}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              data-testid="waitlist-release-count"
            />
          </div>
          <Button
            disabled={!canRelease}
            onClick={() => setConfirming(true)}
            data-testid="waitlist-release-button"
          >
            Release
          </Button>
        </div>
        <a href="/config" className="inline-flex items-center gap-1 text-xs text-[#0d9488] hover:underline">
          Raise the cap in SSM config <ArrowUpRight size={12} strokeWidth={1.5} />
        </a>
        {message && <p className="text-xs text-[#16a34a]" data-testid="waitlist-message">{message}</p>}
        {error && <p className="text-xs text-[#dc2626]" role="alert">{error}</p>}
      </div>

      <ConfirmDialog
        open={confirming}
        title="Release waitlisted users?"
        body={`This activates up to ${count} user(s) from the front of the FIFO queue and emails them. Bounded by the current cap headroom.`}
        confirmLabel="Release"
        onConfirm={release}
        onCancel={() => setConfirming(false)}
      />
    </div>
  )
}

function Stat({ label, value, icon }: { label: string; value?: number; icon?: React.ReactNode }) {
  return (
    <div className="rounded-[12px] border border-[#e2e8f0] bg-white p-4">
      <div className="flex items-center gap-1.5 text-xs text-[#64748b]">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-2xl font-bold tabular-nums text-[#0f172a]">{value ?? '—'}</p>
    </div>
  )
}
