import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { HouseholdService } from '@core/services/households/HouseholdService';
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
  let sut: HouseholdService;

  beforeEach(() => {
    repo = {
      countOwnedByUser: vi.fn(),
      create: vi.fn(),
      findMembershipForUser: vi.fn(),
      findForMember: vi.fn(),
      listMembers: vi.fn(),
      removeMember: vi.fn(),
      disband: vi.fn(),
      leave: vi.fn(),
    };
    sut = new HouseholdService(repo);
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

  describe('disband / removeMember', () => {
    it('throws NotHouseholdOwnerError when disband is rejected by the repo', async () => {
      repo.disband.mockResolvedValue(false);
      await expect(sut.disband('intruder', 'hh-1')).rejects.toBeInstanceOf(NotHouseholdOwnerError);
    });

    it('disbands when the repo confirms ownership', async () => {
      repo.disband.mockResolvedValue(true);
      await sut.disband('owner-1', 'hh-1');
      expect(repo.disband).toHaveBeenCalledWith('hh-1', 'owner-1');
    });

    it('throws NotHouseholdOwnerError when removeMember is rejected', async () => {
      repo.removeMember.mockResolvedValue(false);
      await expect(sut.removeMember('intruder', 'hh-1', 'm2')).rejects.toBeInstanceOf(NotHouseholdOwnerError);
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

    it('lets a non-owner leave', async () => {
      repo.findForMember.mockResolvedValue(summary);
      await sut.leave('member-2', 'hh-1');
      expect(repo.leave).toHaveBeenCalledWith('hh-1', 'member-2');
    });
  });
});
