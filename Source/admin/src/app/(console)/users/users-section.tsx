'use client'

import { useState } from 'react'
import { Plus, Minus } from 'lucide-react'
import { Card } from '@/components/ui/card/card'
import { EmptyState } from '@/components/ui/empty-state/empty-state'

interface User {
  id: string
  email: string
  role: string
  quotaUsed: number
  quotaCap: number
}

export function UsersSection() {
  const [email, setEmail] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [adjusting, setAdjusting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
    setAdjusting(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}/quota-adjustment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()

      // Update user in list
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, quotaUsed: data.used } : u))
      )
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setAdjusting(null)
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
        />
        <button
          onClick={search}
          disabled={loading || !email}
          className="px-4 py-2 bg-brand text-white rounded-lg text-sm disabled:opacity-50"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {users.length === 0 ? (
        <EmptyState
          icon="search"
          title="No users found"
          description="Search by email to find and manage user quotas."
        />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                  Email
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                  Role
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                  Quota (this week)
                </th>
                <th className="text-center px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs font-medium">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {user.quotaUsed} / {user.quotaCap === Infinity ? '∞' : user.quotaCap}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => adjust(user.id, 1)}
                        disabled={adjusting === user.id}
                        title="Add 1 scan"
                        className="p-1 hover:bg-green-100 dark:hover:bg-green-900/30 rounded text-green-600 dark:text-green-400 disabled:opacity-50"
                      >
                        <Plus size={16} />
                      </button>
                      <button
                        onClick={() => adjust(user.id, -1)}
                        disabled={adjusting === user.id}
                        title="Remove 1 scan"
                        className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600 dark:text-red-400 disabled:opacity-50"
                      >
                        <Minus size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
