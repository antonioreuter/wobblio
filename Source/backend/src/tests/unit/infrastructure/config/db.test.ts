import { describe, it, expect, vi } from 'vitest';
import { assertRuntimeRoleCannotBypassRls, RlsBypassError } from '@infrastructure/config/db';

const poolReturning = (row: { role: string; attr_bypass: boolean; owner_bypass: boolean }) => ({
  query: vi.fn().mockResolvedValue({ rows: [row] }),
});

describe('assertRuntimeRoleCannotBypassRls', () => {
  it('passes for a non-owner, non-privileged role', async () => {
    const pool = poolReturning({ role: 'wobblio_app', attr_bypass: false, owner_bypass: false });
    await expect(assertRuntimeRoleCannotBypassRls(pool)).resolves.toBeUndefined();
  });

  it('throws when the role owns RLS tables without FORCE (the silent-leak case)', async () => {
    const pool = poolReturning({ role: 'wobblio_dev_app', attr_bypass: false, owner_bypass: true });
    await expect(assertRuntimeRoleCannotBypassRls(pool)).rejects.toBeInstanceOf(RlsBypassError);
  });

  it('throws when the role is SUPERUSER or has BYPASSRLS', async () => {
    const pool = poolReturning({ role: 'postgres', attr_bypass: true, owner_bypass: false });
    await expect(assertRuntimeRoleCannotBypassRls(pool)).rejects.toBeInstanceOf(RlsBypassError);
  });
});
