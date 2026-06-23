import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { AdminWaitlistService } from '@core/services/admin/AdminWaitlistService';
import type { WaitlistReleaseService } from '@core/services/waitlist/WaitlistReleaseService';
import type { IFreeUserCounter } from '@core/ports/waitlist/IFreeUserCounter';
import type { IWaitlistCapProvider } from '@core/ports/waitlist/IWaitlistCapProvider';
import type { IWaitlistRepository } from '@core/ports/waitlist/IWaitlistRepository';
import type { IAdminAuditLog } from '@core/ports/admin/IAdminAuditLog';
import { InvalidAdminInputError } from '@core/domain/errors';

const ACTOR = { id: 'admin-1', email: 'admin@wobblio.nl' };

describe('AdminWaitlistService', () => {
  let counter: MockedObject<IFreeUserCounter>;
  let cap: MockedObject<IWaitlistCapProvider>;
  let waitlist: MockedObject<IWaitlistRepository>;
  let release: MockedObject<WaitlistReleaseService>;
  let audit: MockedObject<IAdminAuditLog>;
  let sut: AdminWaitlistService;

  beforeEach(() => {
    counter = { tryClaimSlot: vi.fn(), getCurrentCount: vi.fn() };
    cap = { getMaxFreeUsersCap: vi.fn() };
    waitlist = { getWaitlistedBatch: vi.fn(), activateUsers: vi.fn(), getWaitlistCount: vi.fn() };
    release = { releaseEligibleUsers: vi.fn() } as unknown as MockedObject<WaitlistReleaseService>;
    audit = { record: vi.fn() };
    sut = new AdminWaitlistService(counter, cap, waitlist, release, audit);
  });

  it('aggregates free count, cap and queue size', async () => {
    counter.getCurrentCount.mockResolvedValue(97);
    cap.getMaxFreeUsersCap.mockResolvedValue(100);
    waitlist.getWaitlistCount.mockResolvedValue(42);

    expect(await sut.getOverview()).toEqual({ freeUsers: 97, cap: 100, queueSize: 42 });
  });

  it('releases N users (bounded) and audits the actual released count', async () => {
    release.releaseEligibleUsers.mockResolvedValue({ released: 3 });

    const released = await sut.release(ACTOR, 5);

    expect(released).toBe(3);
    expect(release.releaseEligibleUsers).toHaveBeenCalledWith(5);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-1',
        action: 'waitlist.release',
        target: '3',
        after: { requested: 5, released: 3 },
      }),
    );
  });

  it.each([0, -1, 1.5, 1001])('rejects an out-of-range count (%s) without releasing', async (count) => {
    await expect(sut.release(ACTOR, count)).rejects.toBeInstanceOf(InvalidAdminInputError);
    expect(release.releaseEligibleUsers).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});
