import type {
  INotificationRepository,
  NotificationView,
} from '../../ports/notifications/INotificationRepository';

export class NotificationService {
  constructor(private readonly notifications: INotificationRepository) {}

  list(): Promise<NotificationView[]> {
    return this.notifications.listActive();
  }

  // Idempotent: marking an unknown or already-read notification is a no-op.
  async markRead(notificationId: string): Promise<void> {
    await this.notifications.markRead(notificationId);
  }
}
