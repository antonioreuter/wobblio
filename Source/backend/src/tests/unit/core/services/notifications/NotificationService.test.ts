import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { NotificationService } from '@core/services/notifications/NotificationService';
import type { INotificationRepository, NotificationView } from '@core/ports/notifications/INotificationRepository';

const sample: NotificationView = {
  id: 'n1', kind: 'BUDGET_85', title: 'Budget at 85%', body: '…',
  budgetId: 'b1', readAt: null, createdAt: '2026-06-16T00:00:00Z',
};

describe('NotificationService', () => {
  let repo: MockedObject<INotificationRepository>;
  let sut: NotificationService;

  beforeEach(() => {
    repo = { create: vi.fn(), listActive: vi.fn(), markRead: vi.fn(), purgeExpired: vi.fn() };
    sut = new NotificationService(repo);
  });

  it('lists active notifications for the caller', async () => {
    repo.listActive.mockResolvedValue([sample]);
    expect(await sut.list()).toEqual([sample]);
  });

  it('delegates mark-read to the repository', async () => {
    repo.markRead.mockResolvedValue(true);
    await sut.markRead('n1');
    expect(repo.markRead).toHaveBeenCalledWith('n1');
  });
});
