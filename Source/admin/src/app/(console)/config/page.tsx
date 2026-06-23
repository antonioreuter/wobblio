'use client'

import { useCallback, useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface Param {
  key: string
  label: string
  type: 'integer' | 'number' | 'boolean' | 'json'
  sensitive: boolean
  value: string | null
}

export default function ConfigPage() {
  const [params, setParams] = useState<Param[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [pending, setPending] = useState<Param | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/config')
    if (!res.ok) {
      setError('Failed to load parameters')
      return
    }
    const data = await res.json()
    setParams(data.parameters ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function attemptSave(param: Param) {
    setError(null)
    setNotice(null)
    if (param.sensitive) {
      setPending(param)
      return
    }
    void save(param)
  }

  async function save(param: Param) {
    setPending(null)
    const value = drafts[param.key] ?? param.value ?? ''
    const res = await fetch(`/api/admin/config/${param.key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(`${param.label}: ${data.message ?? 'save failed'}`)
      return
    }
    setNotice(`Saved ${param.label}.`)
    await load()
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-fg">SSM Config</h1>
      <p className="text-sm text-muted">
        Changes take effect on the next Lambda warm start or SSM cache expiry.
      </p>

      {notice && <p className="text-xs text-success" data-testid="config-notice">{notice}</p>}
      {error && <p className="text-xs text-danger" role="alert">{error}</p>}

      <div className="overflow-x-auto rounded-[12px] border border-line bg-card">
        <table className="w-full min-w-[640px] text-sm" data-testid="config-table">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="p-3 font-medium">Parameter</th>
              <th className="p-3 font-medium">Value</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {params.map((p) => (
              <tr key={p.key} className="border-b border-line" data-testid="config-row">
                <td className="p-3">
                  <p className="font-medium text-fg">{p.label}</p>
                  <p className="font-mono text-xs text-muted">
                    {p.key} · {p.type}
                    {p.sensitive && <span className="ml-1 text-warning">· sensitive</span>}
                  </p>
                </td>
                <td className="p-3">
                  <Input
                    aria-label={p.label}
                    defaultValue={p.value ?? ''}
                    onChange={(e) => setDrafts((d) => ({ ...d, [p.key]: e.target.value }))}
                    data-testid={`config-input-${p.key}`}
                  />
                </td>
                <td className="p-3 text-right">
                  <Button size="sm" onClick={() => attemptSave(p)} data-testid={`config-save-${p.key}`}>
                    <Save size={12} strokeWidth={1.5} /> Save
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={pending !== null}
        title="Change a high-impact parameter?"
        body={pending ? `${pending.label} affects live runtime behaviour. Confirm the new value.` : ''}
        confirmLabel="Save"
        onConfirm={() => pending && save(pending)}
        onCancel={() => setPending(null)}
      />
    </div>
  )
}
