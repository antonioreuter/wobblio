import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useNotifications, type AppNotification } from './use-notifications'

const row = (over: Partial<AppNotification> = {}): AppNotification => ({
  id: 'n1',
  kind: 'BUDGET_85',
  title: 'Budget at 85%',
  body: 'Your total budget is at 85%.',
  budgetId: 'b1',
  readAt: null,
  createdAt: '2026-06-20T10:00:00Z',
  ...over,
})

const okJson = (data: unknown): Response => ({ ok: true, json: () => Promise.resolve(data) } as Response)

describe('useNotifications', () => {
  afterEach(() => vi.restoreAllMocks())

  it('counts unread by readAt === null', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(okJson({ notifications: [row(), row({ id: 'n2', readAt: '2026-06-20T11:00:00Z' })] })),
    )

    const { result } = renderHook(() => useNotifications())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.notifications).toHaveLength(2)
    expect(result.current.unreadCount).toBe(1)
  })

  it('markRead POSTs to the read route and flips the row optimistically', async () => {
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(url === '/api/notifications' ? okJson({ notifications: [row()] }) : okJson({})),
    )
    global.fetch = fetchMock as unknown as typeof fetch

    const { result } = renderHook(() => useNotifications())
    await waitFor(() => expect(result.current.unreadCount).toBe(1))

    await act(async () => { await result.current.markRead('n1') })

    expect(fetchMock).toHaveBeenCalledWith('/api/notifications/n1/read', { method: 'POST' })
    expect(result.current.unreadCount).toBe(0)
  })
})
