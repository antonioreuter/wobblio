import type { Pool, PoolClient } from 'pg';
import type {
  IDataRequestRepository,
  DataRequestRecord,
  DataRequestStatus,
} from '@core/ports/gdpr/IDataRequestRepository';

interface DbDataRequestRow {
  id: string;
  tenant_id: string;
  status: DataRequestStatus;
  export_s3_key: string | null;
  requested_at: string;
  completed_at: string | null;
}

// FAILED rows never count toward the rate-limit window (§14 decision).
const ACTIVE_STATUSES: DataRequestStatus[] = ['PENDING', 'PROCESSING', 'COMPLETED'];

export class DataRequestRepositoryAdapter implements IDataRequestRepository {
  constructor(private readonly pool: Pool | PoolClient) {}

  async acquireExportLock(tenantId: string): Promise<void> {
    // Transaction-scoped (xact) advisory lock: held until the caller's COMMIT/ROLLBACK, no
    // manual unlock needed. hashtext() folds the UUID into the int4 key the function expects.
    await this.pool.query('SELECT pg_advisory_xact_lock(hashtext($1))', [tenantId]);
  }

  async hasRecentExportRequest(tenantId: string, sinceHours: number): Promise<boolean> {
    const result = await this.pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM data_request
         WHERE tenant_id = $1 AND kind = 'EXPORT' AND status = ANY($2)
           AND requested_at > now() - make_interval(hours => $3)
       ) AS exists`,
      [tenantId, ACTIVE_STATUSES, sinceHours],
    );
    return result.rows[0]?.exists ?? false;
  }

  async createExportRequest(tenantId: string): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `INSERT INTO data_request (tenant_id, kind) VALUES ($1, 'EXPORT') RETURNING id`,
      [tenantId],
    );
    return result.rows[0].id;
  }

  async claimForProcessing(id: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE data_request SET status = 'PROCESSING'
       WHERE id = $1 AND kind = 'EXPORT' AND status IN ('PENDING', 'FAILED')`,
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async getExportById(id: string): Promise<DataRequestRecord | null> {
    const result = await this.pool.query<DbDataRequestRow>(
      `SELECT * FROM data_request WHERE id = $1 AND kind = 'EXPORT'`,
      [id],
    );
    return toRecord(result.rows[0]);
  }

  async getLatestExport(tenantId: string): Promise<DataRequestRecord | null> {
    const result = await this.pool.query<DbDataRequestRow>(
      `SELECT * FROM data_request
       WHERE tenant_id = $1 AND kind = 'EXPORT'
       ORDER BY requested_at DESC LIMIT 1`,
      [tenantId],
    );
    return toRecord(result.rows[0]);
  }

  async markCompleted(id: string, exportS3Key: string): Promise<void> {
    await this.pool.query(
      `UPDATE data_request SET status = 'COMPLETED', export_s3_key = $2, completed_at = now() WHERE id = $1`,
      [id, exportS3Key],
    );
  }

  async markFailed(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE data_request SET status = 'FAILED', completed_at = now() WHERE id = $1`,
      [id],
    );
  }
}

function toRecord(row: DbDataRequestRow | undefined): DataRequestRecord | null {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    status: row.status,
    exportS3Key: row.export_s3_key,
    requestedAt: row.requested_at,
    completedAt: row.completed_at,
  };
}
