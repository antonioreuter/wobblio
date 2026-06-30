import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PoolClient } from 'pg';
import { DeviceTokenRepositoryAdapter } from '@infrastructure/adapters/notifications/DeviceTokenRepositoryAdapter';

describe('DeviceTokenRepositoryAdapter', () => {
  let query: ReturnType<typeof vi.fn>;
  let repo: DeviceTokenRepositoryAdapter;

  beforeEach(() => {
    query = vi.fn().mockResolvedValue({ rows: [{ id: 'dt-1' }], rowCount: 1 });
    repo = new DeviceTokenRepositoryAdapter({ query } as unknown as PoolClient);
  });

  it('upserts on (tenant, platform, token) and clears any prior error, returning the id', async () => {
    const id = await repo.upsert('tenant-1', 'FCM', 'tok-abc');
    expect(id).toBe('dt-1');
    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO device_token');
    expect(sql).toContain('ON CONFLICT (tenant_id, platform, token)');
    expect(sql).toContain('last_error_at = NULL');
    expect(query).toHaveBeenCalledWith(expect.any(String), ['tenant-1', 'FCM', 'tok-abc']);
  });

  it('lists the current tenant tokens (RLS-scoped — no tenant filter in the query)', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'dt-1', platform: 'APNS', token: 'tok-x' }] });
    const tokens = await repo.listForTenant();
    expect(tokens).toEqual([{ id: 'dt-1', platform: 'APNS', token: 'tok-x' }]);
    expect(query.mock.calls[0][0]).toContain('FROM device_token');
  });

  it('deletes a dead token by id', async () => {
    await repo.markDead('dt-9');
    expect(query).toHaveBeenCalledWith('DELETE FROM device_token WHERE id = $1', ['dt-9']);
  });
});
