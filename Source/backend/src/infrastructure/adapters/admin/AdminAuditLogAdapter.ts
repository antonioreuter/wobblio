import type { Pool, PoolClient } from 'pg';
import type {
  IAdminAuditLog,
  AdminAuditEntry,
  AdminAuditAction,
  AdminAuditRow,
} from '@core/ports/admin/IAdminAuditLog';

interface AuditDbRow {
  id: string;
  actor_email: string;
  action: string;
  target: string;
  before: unknown;
  after: unknown;
  created_at: Date;
}

// Writes to admin_audit_log (global, no RLS). JSONB before/after are passed as
// JSON strings so undefined collapses to SQL NULL rather than the string "null".
export class AdminAuditLogAdapter implements IAdminAuditLog {
  constructor(private readonly pool: Pool | PoolClient) {}

  async record(entry: AdminAuditEntry): Promise<void> {
    await this.pool.query(
      `INSERT INTO admin_audit_log
         (actor_user_id, actor_email, action, target, "before", "after")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        entry.actorUserId,
        entry.actorEmail,
        entry.action,
        entry.target,
        entry.before === undefined ? null : JSON.stringify(entry.before),
        entry.after === undefined ? null : JSON.stringify(entry.after),
      ],
    );
  }

  async list(action: AdminAuditAction | undefined, limit: number): Promise<AdminAuditRow[]> {
    const result = await this.pool.query<AuditDbRow>(
      `SELECT id, actor_email, action, target, "before", "after", created_at
       FROM admin_audit_log
       WHERE ($1::text IS NULL OR action = $1)
       ORDER BY created_at DESC
       LIMIT $2`,
      [action ?? null, limit],
    );
    return result.rows.map((r) => ({
      id: r.id,
      actorEmail: r.actor_email,
      action: r.action,
      target: r.target,
      before: r.before,
      after: r.after,
      createdAt: r.created_at.toISOString(),
    }));
  }
}
