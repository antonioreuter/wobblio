import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { AdminFeatureToggleService } from '@core/services/admin/AdminFeatureToggleService';
import type { ITunableParameterStore } from '@core/ports/admin/ITunableParameterStore';
import type { IAdminAuditLog } from '@core/ports/admin/IAdminAuditLog';
import { InvalidAdminInputError, UnknownAdminTargetError } from '@core/domain/errors';

const ACTOR = { id: 'admin-1', email: 'admin@wobblio.nl' };
const FLAG_PATH = '/wobblio/config/features/agentic_pipeline_enabled';

describe('AdminFeatureToggleService', () => {
  let store: MockedObject<ITunableParameterStore>;
  let audit: MockedObject<IAdminAuditLog>;
  let sut: AdminFeatureToggleService;

  beforeEach(() => {
    store = { getValues: vi.fn(), setValue: vi.fn() };
    audit = { record: vi.fn(), list: vi.fn() };
    sut = new AdminFeatureToggleService(store, audit);
  });

  it('lists allowlisted flags with their current enabled state', async () => {
    store.getValues.mockResolvedValue({ [FLAG_PATH]: 'true' });

    const list = await sut.list();

    expect(list).toEqual([
      { feature: 'agentic_pipeline_enabled', label: 'Agentic ingestion pipeline', enabled: true },
    ]);
  });

  it('reports a missing/unset flag as disabled', async () => {
    store.getValues.mockResolvedValue({ [FLAG_PATH]: null });

    const [flag] = await sut.list();

    expect(flag.enabled).toBe(false);
  });

  it('enables a flag: writes "true" and audits before→after', async () => {
    store.getValues.mockResolvedValue({ [FLAG_PATH]: 'false' });

    const result = await sut.toggle(ACTOR, 'agentic_pipeline_enabled', true);

    expect(result).toBe(true);
    expect(store.setValue).toHaveBeenCalledWith(FLAG_PATH, 'true');
    expect(audit.record).toHaveBeenCalledWith({
      actorUserId: 'admin-1',
      actorEmail: 'admin@wobblio.nl',
      action: 'feature.toggle',
      target: 'agentic_pipeline_enabled',
      before: false,
      after: true,
    });
  });

  it('disables a flag: writes "false"', async () => {
    store.getValues.mockResolvedValue({ [FLAG_PATH]: 'true' });

    await sut.toggle(ACTOR, 'agentic_pipeline_enabled', false);

    expect(store.setValue).toHaveBeenCalledWith(FLAG_PATH, 'false');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ before: true, after: false }),
    );
  });

  it('rejects an unknown feature without writing or auditing', async () => {
    await expect(sut.toggle(ACTOR, 'nope', true)).rejects.toBeInstanceOf(UnknownAdminTargetError);
    expect(store.setValue).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('rejects a non-boolean value without writing or auditing', async () => {
    await expect(
      sut.toggle(ACTOR, 'agentic_pipeline_enabled', 'true'),
    ).rejects.toBeInstanceOf(InvalidAdminInputError);
    expect(store.setValue).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('delegates history to the audit log filtered by feature.toggle', async () => {
    audit.list.mockResolvedValue([]);

    await sut.history(50);

    expect(audit.list).toHaveBeenCalledWith('feature.toggle', 50);
  });
});
