import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { UploadAllowanceResolver } from '@core/services/quota/UploadAllowanceResolver';
import type { IHouseholdRepository } from '@core/ports/households/IHouseholdRepository';
import type { IUploadQuotaProvider } from '@core/ports/quota/IUploadQuotaProvider';

const PERSONAL_CAPS: Record<string, number> = {
  STANDARD: 3,
  PREMIUM: 10,
  TESTER: Number.POSITIVE_INFINITY,
  ADMIN: Number.POSITIVE_INFINITY,
};
const HOUSEHOLD_CAP = 15;

describe('UploadAllowanceResolver', () => {
  let households: MockedObject<IHouseholdRepository>;
  let quota: MockedObject<IUploadQuotaProvider>;
  let sut: UploadAllowanceResolver;

  beforeEach(() => {
    households = {
      countOwnedByUser: vi.fn(), create: vi.fn(),
      findMembershipForUser: vi.fn().mockResolvedValue(null),
      getOwnerRole: vi.fn(),
      memberCountForUser: vi.fn(),
      findForMember: vi.fn(), listMembers: vi.fn(),
      removeMember: vi.fn(), disband: vi.fn(), leave: vi.fn(),
    };
    quota = {
      getPersonalUploadsCap: vi.fn().mockImplementation((role: string) => Promise.resolve(PERSONAL_CAPS[role])),
      getHouseholdUploadsCap: vi.fn().mockResolvedValue(HOUSEHOLD_CAP),
    };
    sut = new UploadAllowanceResolver(households, quota);
  });

  it('returns the personal counter and role cap when the user has no household', async () => {
    const allowance = await sut.resolve({ userId: 'u1', role: 'STANDARD' });

    expect(allowance).toEqual({
      householdId: null, isPool: false, counter: 'UPLOADS', quotaOwnerId: 'u1', cap: 3,
    });
    expect(households.memberCountForUser).not.toHaveBeenCalled();
  });

  it('stays personal for a solo household (one member) but reports the household for stamping', async () => {
    households.findMembershipForUser.mockResolvedValue({ householdId: 'hh-1', ownerUserId: 'u1' });
    households.memberCountForUser.mockResolvedValue(1);

    const allowance = await sut.resolve({ userId: 'u1', role: 'STANDARD' });

    expect(allowance).toEqual({
      householdId: 'hh-1', isPool: false, counter: 'UPLOADS', quotaOwnerId: 'u1', cap: 3,
    });
    expect(quota.getHouseholdUploadsCap).not.toHaveBeenCalled();
  });

  it('uses the flat household cap when the owner is a standard role', async () => {
    households.findMembershipForUser.mockResolvedValue({ householdId: 'hh-1', ownerUserId: 'owner' });
    households.memberCountForUser.mockResolvedValue(2);
    households.getOwnerRole.mockResolvedValue('STANDARD');

    const allowance = await sut.resolve({ userId: 'member', role: 'STANDARD' });

    expect(allowance).toEqual({
      householdId: 'hh-1', isPool: true, counter: 'HOUSEHOLD_UPLOADS', quotaOwnerId: 'hh-1', cap: 15,
    });
  });

  it('makes the household pool unlimited when the owner is an operator role (ADMIN)', async () => {
    households.findMembershipForUser.mockResolvedValue({ householdId: 'hh-1', ownerUserId: 'owner' });
    households.memberCountForUser.mockResolvedValue(2);
    households.getOwnerRole.mockResolvedValue('ADMIN');

    const allowance = await sut.resolve({ userId: 'member', role: 'STANDARD' });

    expect(allowance.isPool).toBe(true);
    expect(allowance.cap).toBe(Number.POSITIVE_INFINITY);
    expect(allowance.quotaOwnerId).toBe('hh-1');
  });

  it('falls back to the flat household cap when the owner role cannot be read', async () => {
    households.findMembershipForUser.mockResolvedValue({ householdId: 'hh-1', ownerUserId: 'owner' });
    households.memberCountForUser.mockResolvedValue(2);
    households.getOwnerRole.mockResolvedValue(null);

    const allowance = await sut.resolve({ userId: 'member', role: 'STANDARD' });

    // Owner role unknown → treat the caller's (capped) role → flat household cap.
    expect(allowance.cap).toBe(15);
    expect(allowance.isPool).toBe(true);
  });
});
