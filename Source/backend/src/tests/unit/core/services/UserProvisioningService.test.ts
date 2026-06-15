import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { UserProvisioningService } from '@core/services/UserProvisioningService';
import type { IAppUserRepository, UserProfile } from '@core/ports/IAppUserRepository';
import type { IFreeUserCounter } from '@core/ports/IFreeUserCounter';
import type { IWaitlistCapProvider } from '@core/ports/IWaitlistCapProvider';

const profile: UserProfile = { fullName: 'Test User', country: 'NL', language: 'nl', currency: 'EUR' }

describe('UserProvisioningService', () => {
  let mockUserRepo: MockedObject<IAppUserRepository>;
  let mockCounter: MockedObject<IFreeUserCounter>;
  let mockCap: MockedObject<IWaitlistCapProvider>;
  let sut: UserProvisioningService;

  beforeEach(() => {
    mockUserRepo = { findByCognitoSub: vi.fn(), insertUser: vi.fn(), promoteToPremium: vi.fn(), getProfile: vi.fn(), completeOnboarding: vi.fn() };
    mockCounter = { tryClaimSlot: vi.fn(), getCurrentCount: vi.fn() };
    mockCap = { getMaxFreeUsersCap: vi.fn() };
    sut = new UserProvisioningService(mockUserRepo, mockCounter, mockCap);
  });

  it('inserts user with ACTIVE status when slot is claimed', async () => {
    mockCap.getMaxFreeUsersCap.mockResolvedValue(100);
    mockCounter.tryClaimSlot.mockResolvedValue(true);
    mockUserRepo.insertUser.mockResolvedValue('user-uuid-1');

    const result = await sut.provisionUser('sub-1', 'user@example.com');

    expect(mockCounter.tryClaimSlot).toHaveBeenCalledWith(100);
    expect(mockUserRepo.insertUser).toHaveBeenCalledWith('sub-1', 'user@example.com', 'ACTIVE', undefined);
    expect(result.status).toBe('ACTIVE');
  });

  it('inserts user with WAITLIST status when cap is reached', async () => {
    mockCap.getMaxFreeUsersCap.mockResolvedValue(100);
    mockCounter.tryClaimSlot.mockResolvedValue(false);
    mockUserRepo.insertUser.mockResolvedValue('user-uuid-2');

    const result = await sut.provisionUser('sub-2', 'waitlisted@example.com');

    expect(mockCounter.tryClaimSlot).toHaveBeenCalledWith(100);
    expect(mockUserRepo.insertUser).toHaveBeenCalledWith('sub-2', 'waitlisted@example.com', 'WAITLIST', undefined);
    expect(result.status).toBe('WAITLIST');
  });

  it('passes profile fields through to insertUser', async () => {
    mockCap.getMaxFreeUsersCap.mockResolvedValue(50);
    mockCounter.tryClaimSlot.mockResolvedValue(true);
    mockUserRepo.insertUser.mockResolvedValue('user-uuid-3');

    await sut.provisionUser('google|12345', 'another@test.nl', profile);

    expect(mockUserRepo.insertUser).toHaveBeenCalledWith(
      'google|12345',
      'another@test.nl',
      'ACTIVE',
      profile,
    );
  });
});
