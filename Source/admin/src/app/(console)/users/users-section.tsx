'use client'

import { useState } from 'react'
import { Plus, Minus, Search } from 'lucide-react'
import { Card } from '@/components/ui/card/card'
import { EmptyState } from '@/components/ui/empty-state/empty-state'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface User {
  id: string
  email: string
  role: string
  quotaUsed: number
  quotaCap: number | null // null = unlimited (TESTER/ADMIN)
}

const ROLES = ['STANDARD', 'PREMIUM', 'TESTER', 'ADMIN'] as const

export function UsersSection() {
  const [email, setEmail] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [roleDrafts, setRoleDrafts] = useState<Record<string, string>>({})
  // Every mutation confirms first; these hold the action awaiting confirmation.
  const [pendingAdjust, setPendingAdjust] = useState<{ user: User; delta: number } | null>(null)
  const [pendingRole, setPendingRole] = useState<{ user: User; role: string } | null>(null)

  const search = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users?email=${encodeURIComponent(email)}`)
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setUsers(data.users || [])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const adjust = async (userId: string, delta: number) => {
    setPendingAdjust(null)
    setBusy(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}/quota-adjustment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, quotaUsed: data.used } : u)))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const changeRole = async (userId: string, role: string) => {
    setPendingRole(null)
    setBusy(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: data.role } : u)))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <input
          type="email"
          placeholder="Search by email..."
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm"
          data-testid="users-search-input"
        />
        <button
          onClick={search}
          disabled={loading || !email}
          className="px-4 py-2 bg-brand text-white rounded-lg text-sm disabled:opacity-50"
          data-testid="users-search-button"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm" role="alert">
          {error}
        </div>
      )}

      {users.length === 0 ? (
        <EmptyState
          icon={Search}
          heading="No users found"
          body="Search by email to find and manage user quotas and roles."
        />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm" data-testid="users-table">
            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Role</th>
                <th className="text-right px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Quota (this week)</th>
                <th className="text-center px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {users.map((user) => {
                const draftRole = roleDrafts[user.id] ?? user.role
                return (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                    <td className="px-4 py-3">{user.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <select
                          value={draftRole}
                          onChange={(e) => setRoleDrafts((d) => ({ ...d, [user.id]: e.target.value }))}
                          disabled={busy === user.id}
                          className="px-2 py-1 border border-gray-200 dark:border-gray-800 rounded text-xs bg-card disabled:opacity-50"
                          data-testid={`users-role-select-${user.id}`}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => setPendingRole({ user, role: draftRole })}
                          disabled={busy === user.id || draftRole === user.role}
                          className="px-2 py-1 bg-brand text-white rounded text-xs disabled:opacity-50"
                          data-testid={`users-role-save-${user.id}`}
                        >
                          Change role
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {user.quotaUsed.toLocaleString()} / {user.quotaCap === null ? '∞' : user.quotaCap.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {/* delta is credits GRANTED: +10,000 frees credits (lowers used), -10,000 consumes them. */}
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => setPendingAdjust({ user, delta: 10000 })}
                          disabled={busy === user.id}
                          title="Add 10,000 credits"
                          className="p-1 hover:bg-green-100 dark:hover:bg-green-900/30 rounded text-green-600 dark:text-green-400 disabled:opacity-50"
                          data-testid={`users-quota-plus-${user.id}`}
                        >
                          <Plus size={16} />
                        </button>
                        <button
                          onClick={() => setPendingAdjust({ user, delta: -10000 })}
                          disabled={busy === user.id}
                          title="Remove 10,000 credits"
                          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600 dark:text-red-400 disabled:opacity-50"
                          data-testid={`users-quota-minus-${user.id}`}
                        >
                          <Minus size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}

      <ConfirmDialog
        open={pendingRole !== null}
        title="Change user role?"
        body={
          pendingRole
            ? `Set ${pendingRole.user.email} from ${pendingRole.user.role} to ${pendingRole.role}. This changes the user's quotas and access immediately.`
            : ''
        }
        confirmLabel="Change role"
        destructive
        onConfirm={() => pendingRole && changeRole(pendingRole.user.id, pendingRole.role)}
        onCancel={() => setPendingRole(null)}
      />

      <ConfirmDialog
        open={pendingAdjust !== null}
        title="Adjust weekly credits?"
        body={
          pendingAdjust
            ? `${pendingAdjust.delta > 0 ? 'Grant' : 'Consume'} ${Math.abs(pendingAdjust.delta).toLocaleString()} credits for ${pendingAdjust.user.email}.`
            : ''
        }
        confirmLabel="Confirm"
        onConfirm={() => pendingAdjust && adjust(pendingAdjust.user.id, pendingAdjust.delta)}
        onCancel={() => setPendingAdjust(null)}
      />
    </div>
  )
}
