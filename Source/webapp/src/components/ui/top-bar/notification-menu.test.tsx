import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { NotificationMenu } from './notification-menu'
import type { AppNotification } from '@/hooks/use-notifications/use-notifications'

const markRead = vi.fn()
let state: { notifications: AppNotification[]; unreadCount: number }

vi.mock('@/hooks/use-notifications/use-notifications', () => ({
  useNotifications: () => ({ ...state, loading: false, markRead }),
}))

const row = (over: Partial<AppNotification> = {}): AppNotification => ({
  id: 'n1', kind: 'BUDGET_85', title: 'Budget at 85%', body: 'Your total budget is at 85%.',
  budgetId: 'b1', readAt: null, createdAt: new Date().toISOString(), ...over,
})

describe('NotificationMenu', () => {
  beforeEach(() => {
    cleanup()
    markRead.mockReset()
    state = { notifications: [row()], unreadCount: 1 }
  })

  it('shows the unread badge with the count', () => {
    render(<NotificationMenu />)
    expect(screen.getByTestId('topbar-notifications-badge')).toHaveTextContent('1')
  })

  it('hides the badge when nothing is unread', () => {
    state = { notifications: [row({ readAt: '2026-06-20T11:00:00Z' })], unreadCount: 0 }
    render(<NotificationMenu />)
    expect(screen.queryByTestId('topbar-notifications-badge')).toBeNull()
  })

  it('opens the dropdown and marks an unread item read on click', () => {
    render(<NotificationMenu />)
    fireEvent.click(screen.getByTestId('notification-bell'))
    expect(screen.getByTestId('notification-menu-pop')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('notification-item-n1'))
    expect(markRead).toHaveBeenCalledWith('n1')
  })
})
