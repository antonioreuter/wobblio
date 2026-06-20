import { useCallback, useEffect, useState } from 'react'

export interface AppNotification {
  id: string
  kind: string
  title: string
  body: string
  budgetId: string | null
  readAt: string | null
  createdAt: string
}

const POLL_INTERVAL_MS = 30_000

// Surfaces the in-app notification feed (budget 85%/100% alerts today). Polls the
// same-origin BFF route so the backend base URL stays server-side, refetches when
// the tab regains focus, and marks rows read optimistically.
export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (): Promise<AppNotification[] | null> => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' })
      if (!res.ok) return null
      const data = (await res.json()) as { notifications?: AppNotification[] }
      return data.notifications ?? []
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      const next = await load()
      if (cancelled || next === null) return
      setNotifications(next)
      setLoading(false)
    }

    void refresh()
    const interval = window.setInterval(refresh, POLL_INTERVAL_MS)
    window.addEventListener('focus', refresh)
    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.removeEventListener('focus', refresh)
    }
  }, [load])

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id && n.readAt === null ? { ...n, readAt: new Date().toISOString() } : n)),
    )
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'POST' })
    } catch {
      // Optimistic update stands; the next poll reconciles on failure.
    }
  }, [])

  const unreadCount = notifications.filter((n) => n.readAt === null).length
  return { notifications, unreadCount, loading, markRead }
}
