'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { useNotifications, type AppNotification } from '@/hooks/use-notifications/use-notifications'

// Compact relative time for the feed ("just now", "5m", "3h", "2d").
function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

// In-app notification bell: surfaces budget 85%/100% alerts the backend already
// persists. Mirrors UserMenu's trigger + dropdown + outside-click/Escape close.
export function NotificationMenu() {
  const { notifications, unreadCount, markRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const onItemClick = (item: AppNotification) => {
    if (item.readAt === null) void markRead(item.id)
  }

  return (
    <div className="notification-menu" ref={ref}>
      <button
        type="button"
        className="btn-icon notification-bell"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        data-testid="notification-bell"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="notification-unread-badge" data-testid="topbar-notifications-badge">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="notification-menu-pop" role="menu" data-testid="notification-menu-pop">
          <div className="notification-menu-head">Notifications</div>
          {notifications.length === 0 ? (
            <p className="notification-empty">You’re all caught up.</p>
          ) : (
            notifications.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`notification-item${item.readAt === null ? ' notification-item--unread' : ''}`}
                role="menuitem"
                onClick={() => onItemClick(item)}
                data-testid={`notification-item-${item.id}`}
              >
                {item.readAt === null && <span className="notification-unread-dot" aria-hidden="true" />}
                <span className="notification-item-body">
                  <span className="notification-item-title">{item.title}</span>
                  <span className="notification-item-text">{item.body}</span>
                </span>
                <span className="notification-item-time">{relativeTime(item.createdAt)}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
