import type { PoolClient } from 'pg';
import type { ITenantContext } from '@core/ports/identity/ITenantContext';

export class TenantContextAdapter implements ITenantContext {
  constructor(private readonly client: PoolClient) {}

  async setTenantId(tenantId: string): Promise<void> {
    // SET does not accept bind parameters; set_config(..., is_local=true) is the
    // parameter-safe equivalent of SET LOCAL (scoped to the current transaction).
    await this.client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
  }
}
