import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { AdminConfigService } from '@core/services/admin/AdminConfigService';
import type { ITunableParameterStore } from '@core/ports/admin/ITunableParameterStore';
import type { IAdminAuditLog } from '@core/ports/admin/IAdminAuditLog';
import { InvalidAdminInputError, UnknownAdminTargetError } from '@core/domain/errors';

const ACTOR = { id: 'admin-1', email: 'admin@wobblio.nl' };
const CAP_PATH = '/wobblio/config/quotas/max_free_waitlist_cap';

describe('AdminConfigService', () => {
  let store: MockedObject<ITunableParameterStore>;
  let audit: MockedObject<IAdminAuditLog>;
  let sut: AdminConfigService;

  beforeEach(() => {
    store = { getValues: vi.fn(), setValue: vi.fn() };
    audit = { record: vi.fn() };
    sut = new AdminConfigService(store, audit);
  });

  it('lists all allowlisted params with current values', async () => {
    store.getValues.mockResolvedValue({ [CAP_PATH]: '5000' });
    const list = await sut.list();
    const cap = list.find((p) => p.key === 'max_free_users_cap');
    expect(cap).toMatchObject({ value: '5000', type: 'integer', sensitive: true });
    expect(list.length).toBeGreaterThanOrEqual(9);
  });

  it('validates, writes and audits before/after on a known param', async () => {
    store.getValues.mockResolvedValue({ [CAP_PATH]: '5000' });

    const next = await sut.update(ACTOR, 'max_free_users_cap', 6000);

    expect(next).toBe('6000');
    expect(store.setValue).toHaveBeenCalledWith(CAP_PATH, '6000');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ssm.update',
        target: 'max_free_users_cap',
        before: '5000',
        after: '6000',
      }),
    );
  });

  it('rejects an unknown param key without writing', async () => {
    await expect(sut.update(ACTOR, 'nope', 1)).rejects.toBeInstanceOf(UnknownAdminTargetError);
    expect(store.setValue).not.toHaveBeenCalled();
  });

  it('rejects a value that fails type validation without writing', async () => {
    await expect(sut.update(ACTOR, 'max_free_users_cap', 'abc')).rejects.toBeInstanceOf(
      InvalidAdminInputError,
    );
    expect(store.setValue).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});
