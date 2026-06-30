import type { Pool, PoolClient } from 'pg';
import type {
  IDeviceTokenRepository,
  DeviceToken,
  PushPlatform,
} from '@core/ports/notifications/IDeviceTokenRepository';

interface DeviceTokenRow {
  id: string;
  platform: PushPlatform;
  token: string;
}

// All operations are RLS-scoped to the tenant context the caller set (the endpoint runs
// inside withTenantTx; the SNS pusher opens its own tenant-scoped transaction). On
// re-registration the unique conflict clears last_error_at so a recovered device resumes.
export class DeviceTokenRepositoryAdapter implements IDeviceTokenRepository {
  constructor(private readonly db: Pool | PoolClient) {}

  async upsert(tenantId: string, platform: PushPlatform, token: string): Promise<string> {
    const result = await this.db.query<{ id: string }>(
      `INSERT INTO device_token (tenant_id, platform, token)
       VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, platform, token)
       DO UPDATE SET last_error_at = NULL
       RETURNING id`,
      [tenantId, platform, token],
    );
    return result.rows[0].id;
  }

  async listForTenant(): Promise<DeviceToken[]> {
    const result = await this.db.query<DeviceTokenRow>(
      `SELECT id, platform, token FROM device_token`,
    );
    return result.rows;
  }

  async markDead(id: string): Promise<void> {
    await this.db.query(`DELETE FROM device_token WHERE id = $1`, [id]);
  }
}
