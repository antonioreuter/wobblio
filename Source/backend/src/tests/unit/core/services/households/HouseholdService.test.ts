import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { HouseholdService } from '@core/services/households/HouseholdService';
import { HouseholdCarryOverService } from '@core/services/households/HouseholdCarryOverService';
import type {
  IHouseholdRepository,
  HouseholdSummary,
  HouseholdMember,
} from '@core/ports/households/IHouseholdRepository';
import {
  PremiumRequiredError,
  AlreadyOwnsHouseholdError,
  InvalidHouseholdError,
  HouseholdNotFoundError,
  NotHouseholdOwnerError,
  OwnerCannotLeaveError,
} from '@core/domain/errors';

const summary: HouseholdSummary = { id: 'hh-1', name: 'The Smiths', ownerUserId: 'owner-1' };

describe('HouseholdService', () => {
  let repo: MockedObject<IHouseholdRepository>;
  let carryOver: MockedObject<HouseholdCarryOverService>;
  let sut: HouseholdService;

  beforeEach(() => {
    repo = {
      countOwnedByUser: vi.fn(),
      create: vi.fn(),
      findMembershipForUser: vi.fn(),
      getOwnerRole: vi.fn(),
      memberCountForUser: vi.fn().mockResolvedValue(0),
      findForMember: vi.fn(),
      listMembers: vi.fn(),
      removeMember: vi.fn(),
      disband: vi.fn(),
      leave: vi.fn(),
      carryOverPoolOnActivate: vi.fn(),
      settlePoolToOwner: vi.fn(),
    };
    carryOver = {
      onMemberJoined: vi.fn(),
      onMemberRemoved: vi.fn(),
      onDisband: vi.fn(),
    } as unknown as MockedObject<HouseholdCarryOverService>;
    sut = new HouseholdService(repo, carryOver);
  });

  describe('create', () => {
    it('rejects non-PREMIUM users', async () => {
      await expect(sut.create('u1', 'STANDARD', 'Home')).rejects.toBeInstanceOf(PremiumRequiredError);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('rejects a blank name', async () => {
      await expect(sut.create('u1', 'PREMIUM', '   ')).rejects.toBeInstanceOf(InvalidHouseholdError);
    });

    it('rejects when the user already owns a household', async () => {
      repo.countOwnedByUser.mockResolvedValue(1);

      await expect(sut.create('u1', 'PREMIUM', 'Home')).rejects.toBeInstanceOf(AlreadyOwnsHouseholdError);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('creates a trimmed household for an eligible premium user', async () => {
      repo.countOwnedByUser.mockResolvedValue(0);
      repo.create.mockResolvedValue('hh-9');

      const result = await sut.create('u1', 'PREMIUM', '  Home  ');

      expect(result).toEqual({ id: 'hh-9', name: 'Home', ownerUserId: 'u1' });
      expect(repo.create).toHaveBeenCalledWith('u1', 'Home');
    });
  });

  describe('getDetail', () => {
    it('throws when the caller is not a member', async () => {
      repo.findForMember.mockResolvedValue(null);
      await expect(sut.getDetail('hh-1')).rejects.toBeInstanceOf(HouseholdNotFoundError);
    });

    it('returns the summary plus the member roster', async () => {
      const members: HouseholdMember[] = [
        { userId: 'owner-1', email: 'o@x.com', fullName: 'Owner', isOwner: true, uploadsThisWeek: 2 },
      ];
      repo.findForMember.mockResolvedValue(summary);
      repo.listMembers.mockResolvedValue(members);

      const result = await sut.getDetail('hh-1');

      expect(result).toEqual({ ...summary, members });
    });
  });

  describe('getOwnHousehold', () => {
    it('returns null when the user belongs to no household', async () => {
      repo.findMembershipForUser.mockResolvedValue(null);

      const result = await sut.getOwnHousehold('solo-user');

      expect(result).toBeNull();
      expect(repo.listMembers).not.toHaveBeenCalled();
    });

    it('returns the membership household detail with its roster', async () => {
      const members: HouseholdMember[] = [
        { userId: 'owner-1', email: 'o@x.com', fullName: 'Owner', isOwner: true, uploadsThisWeek: 0 },
      ];
      repo.findMembershipForUser.mockResolvedValue({ householdId: 'hh-1', ownerUserId: 'owner-1' });
      repo.findForMember.mockResolvedValue(summary);
      repo.listMembers.mockResolvedValue(members);

      const result = await sut.getOwnHousehold('owner-1');

      expect(result).toEqual({ ...summary, members });
      expect(repo.findForMember).toHaveBeenCalledWith('hh-1');
    });
  });

  describe('disband / removeMember', () => {
    it('throws NotHouseholdOwnerError when a non-owner member disbands', async () => {
      repo.findForMember.mockResolvedValue(summary);
      await expect(sut.disband('intruder', 'hh-1')).rejects.toBeInstanceOf(NotHouseholdOwnerError);
      expect(repo.disband).not.toHaveBeenCalled();
      expect(carryOver.onDisband).not.toHaveBeenCalled();
    });

    it('throws HouseholdNotFoundError when a non-member disbands', async () => {
      repo.findForMember.mockResolvedValue(null);
      await expect(sut.disband('outsider', 'hh-1')).rejects.toBeInstanceOf(HouseholdNotFoundError);
    });

    it('settles the pool then disbands when the owner confirms', async () => {
      repo.findForMember.mockResolvedValue(summary);
      repo.memberCountForUser.mockResolvedValue(2);
      repo.disband.mockResolvedValue(true);

      await sut.disband('owner-1', 'hh-1');

      expect(carryOver.onDisband).toHaveBeenCalledWith('hh-1', 2);
      expect(repo.disband).toHaveBeenCalledWith('hh-1', 'owner-1');
    });

    it('throws NotHouseholdOwnerError if the repo-level disband guard fails despite the service-level ownership check passing (race defense)', async () => {
      repo.findForMember.mockResolvedValue(summary);
      repo.memberCountForUser.mockResolvedValue(1);
      repo.disband.mockResolvedValue(false);

      await expect(sut.disband('owner-1', 'hh-1')).rejects.toBeInstanceOf(NotHouseholdOwnerError);
    });

    it('throws HouseholdNotFoundError when a non-member removes a member', async () => {
      repo.findForMember.mockResolvedValue(null);
      await expect(sut.removeMember('outsider', 'hh-1', 'm2')).rejects.toBeInstanceOf(HouseholdNotFoundError);
      expect(repo.removeMember).not.toHaveBeenCalled();
    });

    it('throws NotHouseholdOwnerError when a member-but-non-owner removes a member', async () => {
      repo.findForMember.mockResolvedValue(summary);
      repo.removeMember.mockResolvedValue(false);
      await expect(sut.removeMember('member-2', 'hh-1', 'm3')).rejects.toBeInstanceOf(NotHouseholdOwnerError);
      expect(carryOver.onMemberRemoved).not.toHaveBeenCalled();
    });

    it('settles the pool after a successful removal that empties it', async () => {
      repo.findForMember.mockResolvedValue(summary);
      repo.memberCountForUser.mockResolvedValue(2);
      repo.removeMember.mockResolvedValue(true);

      await sut.removeMember('owner-1', 'hh-1', 'm2');

      expect(repo.removeMember).toHaveBeenCalledWith('hh-1', 'm2', 'owner-1');
      expect(carryOver.onMemberRemoved).toHaveBeenCalledWith('hh-1', 2);
    });
  });

  describe('leave', () => {
    it('throws when the caller is not a member', async () => {
      repo.findForMember.mockResolvedValue(null);
      await expect(sut.leave('u2', 'hh-1')).rejects.toBeInstanceOf(HouseholdNotFoundError);
    });

    it('prevents the owner from leaving', async () => {
      repo.findForMember.mockResolvedValue(summary);
      await expect(sut.leave('owner-1', 'hh-1')).rejects.toBeInstanceOf(OwnerCannotLeaveError);
      expect(repo.leave).not.toHaveBeenCalled();
    });

    it('lets a non-owner leave and settles the pool on the count it had before', async () => {
      repo.findForMember.mockResolvedValue(summary);
      repo.memberCountForUser.mockResolvedValue(2);

      await sut.leave('member-2', 'hh-1');

      expect(repo.leave).toHaveBeenCalledWith('hh-1', 'member-2');
      expect(carryOver.onMemberRemoved).toHaveBeenCalledWith('hh-1', 2);
    });
  });
});
