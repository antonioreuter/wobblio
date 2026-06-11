import type { PoolClient } from 'pg';
import type { ITenantContext } from '@core/ports/ITenantContext';

export class TenantContextAdapter implements ITenantContext {
  constructor(private readonly client: PoolClient) {}

  async setTenantId(tenantId: string): Promise<void> {
    await this.client.query('SET LOCAL app.current_tenant_id = $1', [tenantId]);
  }
}
