import type { Pool, PoolClient } from 'pg';
import type {
  INotificationRepository,
  NotificationInput,
  NotificationView,
} from '@core/ports/notifications/INotificationRepository';

interface NotificationRow {
  id: string;
  kind: string;
  title: string;
  body: string;
  budget_id: string | null;
  read_at: string | null;
  created_at: string;
}

// listActive/markRead are RLS-scoped to the caller; create/purgeExpired use
// SECURITY DEFINER functions so the cron can write/clean across tenants.
export class NotificationRepositoryAdapter implements INotificationRepository {
  constructor(private readonly pool: Pool | PoolClient) {}

  async create(input: NotificationInput): Promise<void> {
    await this.pool.query(
      `SELECT insert_notification($1, $2, $3, $4, $5, $6)`,
      [input.tenantId, input.kind, input.title, input.body, input.budgetId, input.ttlDays],
    );
  }

  async listActive(): Promise<NotificationView[]> {
    const result = await this.pool.query<NotificationRow>(
      `SELECT id, kind, title, body, budget_id,
              read_at::text AS read_at, created_at::text AS created_at
       FROM notification
       WHERE expires_at > now()
       ORDER BY created_at DESC`,
    );
    return result.rows.map(row => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      body: row.body,
      budgetId: row.budget_id,
      readAt: row.read_at,
      createdAt: row.created_at,
    }));
  }

  async markRead(notificationId: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE notification SET read_at = now() WHERE id = $1 AND read_at IS NULL`,
      [notificationId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async purgeExpired(): Promise<number> {
    const result = await this.pool.query<{ purge_expired_notifications: number }>(
      `SELECT purge_expired_notifications()`,
    );
    return result.rows[0].purge_expired_notifications;
  }
}
