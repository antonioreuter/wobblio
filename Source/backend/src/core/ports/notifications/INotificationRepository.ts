export interface NotificationInput {
  tenantId: string;
  kind: string;
  title: string;
  body: string;
  budgetId: string | null;
  ttlDays: number;
}

export interface NotificationView {
  id: string;
  kind: string;
  title: string;
  body: string;
  budgetId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface INotificationRepository {
  // Cross-tenant safe (explicit tenantId) — used by the budget-recycler cron.
  create(input: NotificationInput): Promise<void>;
  // RLS-scoped to the caller — non-expired only.
  listActive(): Promise<NotificationView[]>;
  markRead(notificationId: string): Promise<boolean>;
  purgeExpired(): Promise<number>;
}
