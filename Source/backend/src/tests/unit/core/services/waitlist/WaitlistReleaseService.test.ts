import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { WaitlistReleaseService } from '@core/services/waitlist/WaitlistReleaseService';
import type { IFreeUserCounter } from '@core/ports/waitlist/IFreeUserCounter';
import type { IWaitlistCapProvider } from '@core/ports/waitlist/IWaitlistCapProvider';
import type { IWaitlistRepository } from '@core/ports/waitlist/IWaitlistRepository';
import type { IEmailSender } from '@core/ports/notifications/IEmailSender';

const makeUsers = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: `user-${i}`, email: `user${i}@test.nl` }));

describe('WaitlistReleaseService', () => {
  let mockCounter: MockedObject<IFreeUserCounter>;
  let mockCap: MockedObject<IWaitlistCapProvider>;
  let mockWaitlist: MockedObject<IWaitlistRepository>;
  let mockEmail: MockedObject<IEmailSender>;
  let sut: WaitlistReleaseService;

  beforeEach(() => {
    mockCounter = { tryClaimSlot: vi.fn(), getCurrentCount: vi.fn() };
    mockCap = { getMaxFreeUsersCap: vi.fn() };
    mockWaitlist = { getWaitlistedBatch: vi.fn(), activateUsers: vi.fn(), getWaitlistCount: vi.fn() };
    mockEmail = { sendWaitlistRelease: vi.fn() };
    sut = new WaitlistReleaseService(mockCounter, mockCap, mockWaitlist, mockEmail);
  });

  it('returns released=0 when no slots are available', async () => {
    mockCap.getMaxFreeUsersCap.mockResolvedValue(100);
    mockCounter.getCurrentCount.mockResolvedValue(100);

    const result = await sut.releaseEligibleUsers();

    expect(result).toEqual({ released: 0 });
    expect(mockWaitlist.getWaitlistedBatch).not.toHaveBeenCalled();
    expect(mockEmail.sendWaitlistRelease).not.toHaveBeenCalled();
  });

  it('returns released=0 when waitlist batch is empty', async () => {
    mockCap.getMaxFreeUsersCap.mockResolvedValue(100);
    mockCounter.getCurrentCount.mockResolvedValue(97);
    mockWaitlist.getWaitlistedBatch.mockResolvedValue([]);

    const result = await sut.releaseEligibleUsers();

    expect(result).toEqual({ released: 0 });
    expect(mockWaitlist.activateUsers).not.toHaveBeenCalled();
    expect(mockEmail.sendWaitlistRelease).not.toHaveBeenCalled();
  });

  it('activates all users and sends emails when 3 slots are available', async () => {
    mockCap.getMaxFreeUsersCap.mockResolvedValue(100);
    mockCounter.getCurrentCount.mockResolvedValue(97);
    mockWaitlist.getWaitlistedBatch.mockResolvedValue(makeUsers(3));
    mockCounter.tryClaimSlot.mockResolvedValue(true);
    mockWaitlist.activateUsers.mockResolvedValue(3);
    mockEmail.sendWaitlistRelease.mockResolvedValue(undefined);

    const result = await sut.releaseEligibleUsers();

    expect(mockWaitlist.activateUsers).toHaveBeenCalledWith(['user-0', 'user-1', 'user-2']);
    expect(mockEmail.sendWaitlistRelease).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ released: 3 });
  });

  it('stops claiming slots early when mid-batch tryClaimSlot returns false', async () => {
    mockCap.getMaxFreeUsersCap.mockResolvedValue(100);
    mockCounter.getCurrentCount.mockResolvedValue(98);
    mockWaitlist.getWaitlistedBatch.mockResolvedValue(makeUsers(2));
    mockCounter.tryClaimSlot
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    mockWaitlist.activateUsers.mockResolvedValue(1);
    mockEmail.sendWaitlistRelease.mockResolvedValue(undefined);

    const result = await sut.releaseEligibleUsers();

    expect(mockWaitlist.activateUsers).toHaveBeenCalledWith(['user-0']);
    expect(mockEmail.sendWaitlistRelease).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ released: 1 });
  });

  it('returns released=0 when first tryClaimSlot fails', async () => {
    mockCap.getMaxFreeUsersCap.mockResolvedValue(100);
    mockCounter.getCurrentCount.mockResolvedValue(99);
    mockWaitlist.getWaitlistedBatch.mockResolvedValue(makeUsers(1));
    mockCounter.tryClaimSlot.mockResolvedValue(false);

    const result = await sut.releaseEligibleUsers();

    expect(result).toEqual({ released: 0 });
    expect(mockWaitlist.activateUsers).not.toHaveBeenCalled();
  });

  it('requests correct batch size from waitlist repo', async () => {
    mockCap.getMaxFreeUsersCap.mockResolvedValue(100);
    mockCounter.getCurrentCount.mockResolvedValue(95);
    mockWaitlist.getWaitlistedBatch.mockResolvedValue([]);

    await sut.releaseEligibleUsers();

    expect(mockWaitlist.getWaitlistedBatch).toHaveBeenCalledWith(5);
  });
});
