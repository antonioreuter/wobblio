'use client'

import { useCallback, useEffect, useState } from 'react'
import { Save, Gauge } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ConsoleSection } from '@/components/ui/console-section'

interface Quota {
  key: string
  label: string
  kind: 'uploads' | 'household' | 'upload_limit'
  role: string | null
  value: string | null
  allowUnlimited: boolean
}

// -1 is the "unlimited" sentinel persisted in SSM; surface it as ∞ to operators.
function display(value: string | null): string {
  if (value === null) return '—'
  return value.trim() === '-1' ? '∞ unlimited' : value
}

export function QuotasSection() {
  const [quotas, setQuotas] = useState<Quota[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [pending, setPending] = useState<Quota | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/quotas')
    if (!res.ok) {
      setError('Failed to load quotas')
      return
    }
    const data = await res.json()
    setQuotas(data.quotas ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function save(quota: Quota) {
    setPending(null)
    const value = drafts[quota.key] ?? quota.value ?? ''
    const res = await fetch(`/api/admin/quotas/${quota.key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(`${quota.label}: ${data.message ?? 'save failed'}`)
      return
    }
    setNotice(`Saved ${quota.label}.`)
    await load()
  }

  return (
    <ConsoleSection
      id="quotas"
      icon={Gauge}
      title="Quotas"
      description="Global weekly caps per role. -1 means unlimited (TESTER/ADMIN). Changes take effect on the next Lambda warm start or SSM cache expiry."
    >
      {notice && <p className="text-xs text-success" data-testid="quotas-notice">{notice}</p>}
      {error && <p className="text-xs text-danger" role="alert">{error}</p>}

      <div className="overflow-x-auto rounded-[12px] border border-line bg-card">
        <table className="w-full min-w-[640px] text-sm" data-testid="quotas-table">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="p-3 font-medium">Quota</th>
              <th className="p-3 font-medium">Current</th>
              <th className="p-3 font-medium">New value</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {quotas.map((q) => (
              <tr key={q.key} className="border-b border-line last:border-0" data-testid="quotas-row">
                <td className="p-3">
                  <p className="font-medium text-fg">{q.label}</p>
                  <p className="font-mono text-xs text-muted">
                    {q.kind}
                    {q.allowUnlimited && <span className="ml-1 text-warning">· -1 = ∞</span>}
                  </p>
                </td>
                <td className="p-3 font-mono text-xs text-muted">{display(q.value)}</td>
                <td className="p-3">
                  <Input
                    type="number"
                    aria-label={q.label}
                    defaultValue={q.value ?? ''}
                    onChange={(e) => setDrafts((d) => ({ ...d, [q.key]: e.target.value }))}
                    data-testid={`quotas-input-${q.key}`}
                  />
                </td>
                <td className="p-3 text-right">
                  <Button
                    size="sm"
                    onClick={() => {
                      setError(null)
                      setNotice(null)
                      setPending(q)
                    }}
                    data-testid={`quotas-save-${q.key}`}
                  >
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
        title="Change a global quota?"
        body={
          pending
            ? pending.kind === 'upload_limit'
              ? `${pending.label} applies to every upload. Confirm the new limit.`
              : `${pending.label} applies to every ${pending.role ?? 'household'} user. Confirm the new weekly cap.`
            : ''
        }
        confirmLabel="Save"
        onConfirm={() => pending && save(pending)}
        onCancel={() => setPending(null)}
      />
    </ConsoleSection>
  )
}
