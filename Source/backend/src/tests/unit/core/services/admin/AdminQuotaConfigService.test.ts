import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { AdminQuotaConfigService } from '@core/services/admin/AdminQuotaConfigService';
import type { ITunableParameterStore } from '@core/ports/admin/ITunableParameterStore';
import type { IAdminAuditLog } from '@core/ports/admin/IAdminAuditLog';
import { InvalidAdminInputError, UnknownAdminTargetError } from '@core/domain/errors';

const ACTOR = { id: 'admin-1', email: 'admin@wobblio.nl' };
const STANDARD_PATH = '/wobblio/config/quotas/standard_uploads_per_week';
const TESTER_PATH = '/wobblio/config/quotas/tester_uploads_per_week';

describe('AdminQuotaConfigService', () => {
  let store: MockedObject<ITunableParameterStore>;
  let audit: MockedObject<IAdminAuditLog>;
  let sut: AdminQuotaConfigService;

  beforeEach(() => {
    store = { getValues: vi.fn(), setValue: vi.fn() };
    audit = { record: vi.fn() };
    sut = new AdminQuotaConfigService(store, audit);
  });

  it('lists every quota cap with its current value and role', async () => {
    store.getValues.mockResolvedValue({ [STANDARD_PATH]: '3', [TESTER_PATH]: '-1' });
    const list = await sut.list();
    expect(list).toHaveLength(9);
    expect(list.find((q) => q.key === 'standard_uploads_per_week')).toMatchObject({
      value: '3',
      role: 'STANDARD',
      kind: 'uploads',
      allowUnlimited: false,
    });
    expect(list.find((q) => q.key === 'tester_uploads_per_week')).toMatchObject({
      value: '-1',
      role: 'TESTER',
      allowUnlimited: true,
    });
  });

  it('validates, writes and audits before/after on a known cap', async () => {
    store.getValues.mockResolvedValue({ [STANDARD_PATH]: '3' });

    const next = await sut.update(ACTOR, 'standard_uploads_per_week', 5);

    expect(next).toBe('5');
    expect(store.setValue).toHaveBeenCalledWith(STANDARD_PATH, '5');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'quota.config',
        target: 'standard_uploads_per_week',
        before: '3',
        after: '5',
      }),
    );
  });

  it('rejects an unknown quota key without writing', async () => {
    await expect(sut.update(ACTOR, 'nope', 1)).rejects.toBeInstanceOf(UnknownAdminTargetError);
    expect(store.setValue).not.toHaveBeenCalled();
  });

  it('rejects -1 for a capped role and never writes or audits', async () => {
    await expect(sut.update(ACTOR, 'standard_uploads_per_week', -1)).rejects.toBeInstanceOf(
      InvalidAdminInputError,
    );
    expect(store.setValue).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});
