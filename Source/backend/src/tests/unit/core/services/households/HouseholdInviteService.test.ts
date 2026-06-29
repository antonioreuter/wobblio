import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { HouseholdInviteService } from '@core/services/households/HouseholdInviteService';
import { HouseholdCarryOverService } from '@core/services/households/HouseholdCarryOverService';
import type { IHouseholdRepository, HouseholdSummary } from '@core/ports/households/IHouseholdRepository';
import type { IHouseholdInviteRepository } from '@core/ports/households/IHouseholdInviteRepository';
import type { ISecureToken } from '@core/ports/security/ISecureToken';
import type { IKmsEncryption } from '@core/ports/security/IKmsEncryption';
import {
  HouseholdNotFoundError,
  NotHouseholdOwnerError,
  HouseholdFullError,
  InvalidInviteError,
} from '@core/domain/errors';

const owned: HouseholdSummary = { id: 'hh-1', name: 'Home', ownerUserId: 'owner-1' };

describe('HouseholdInviteService', () => {
  let households: MockedObject<IHouseholdRepository>;
  let invites: MockedObject<IHouseholdInviteRepository>;
  let token: MockedObject<ISecureToken>;
  let encryption: MockedObject<IKmsEncryption>;
  let carryOver: MockedObject<HouseholdCarryOverService>;
  let sut: HouseholdInviteService;

  beforeEach(() => {
    households = {
      countOwnedByUser: vi.fn(),
      create: vi.fn(),
      findMembershipForUser: vi.fn(),
      getOwnerRole: vi.fn(),
      memberCountForUser: vi.fn().mockResolvedValue(2),
      findForMember: vi.fn(),
      listMembers: vi.fn(),
      removeMember: vi.fn(),
      disband: vi.fn(),
      leave: vi.fn(),
      carryOverPoolOnActivate: vi.fn(),
      settlePoolToOwner: vi.fn(),
    };
    invites = { create: vi.fn(), revoke: vi.fn(), accept: vi.fn() };
    token = { generate: vi.fn().mockReturnValue('raw-token'), hash: vi.fn().mockReturnValue('hashed') };
    encryption = { encrypt: vi.fn().mockResolvedValue('enc'), decrypt: vi.fn() };
    carryOver = {
      onMemberJoined: vi.fn(),
      onMemberRemoved: vi.fn(),
      onDisband: vi.fn(),
    } as unknown as MockedObject<HouseholdCarryOverService>;
    sut = new HouseholdInviteService(households, invites, token, encryption, carryOver);
  });

  describe('createInvite', () => {
    it('throws when the household is missing', async () => {
      households.findForMember.mockResolvedValue(null);
      await expect(sut.createInvite('owner-1', 'hh-1')).rejects.toBeInstanceOf(HouseholdNotFoundError);
    });

    it('rejects a non-owner', async () => {
      households.findForMember.mockResolvedValue({ ...owned, ownerUserId: 'someone-else' });
      await expect(sut.createInvite('owner-1', 'hh-1')).rejects.toBeInstanceOf(NotHouseholdOwnerError);
    });

    it('generates, encrypts and stores a hashed token', async () => {
      households.findForMember.mockResolvedValue(owned);
      invites.create.mockResolvedValue('inv-1');

      const result = await sut.createInvite('owner-1', 'hh-1');

      expect(encryption.encrypt).toHaveBeenCalledWith('raw-token');
      expect(invites.create).toHaveBeenCalledWith(
        expect.objectContaining({
          householdId: 'hh-1',
          createdByUserId: 'owner-1',
          tokenHash: 'hashed',
          tokenEnc: 'enc',
        }),
      );
      expect(result).toMatchObject({ inviteId: 'inv-1', token: 'raw-token' });
      expect(typeof result.expiresAt).toBe('string');
    });
  });

  describe('revokeInvite', () => {
    it('throws when no open invite matches', async () => {
      households.findForMember.mockResolvedValue(owned);
      invites.revoke.mockResolvedValue(false);
      await expect(sut.revokeInvite('owner-1', 'hh-1', 'inv-x')).rejects.toBeInstanceOf(InvalidInviteError);
    });

    it('revokes for the owner', async () => {
      households.findForMember.mockResolvedValue(owned);
      invites.revoke.mockResolvedValue(true);

      await sut.revokeInvite('owner-1', 'hh-1', 'inv-1');

      expect(invites.revoke).toHaveBeenCalledWith('hh-1', 'inv-1');
    });
  });

  describe('acceptInvite', () => {
    it('hashes the raw token before lookup', async () => {
      invites.accept.mockResolvedValue({ code: 'OK', householdId: 'hh-1' });
      households.findForMember.mockResolvedValue(owned);

      await sut.acceptInvite('joiner', 'raw-token');

      expect(token.hash).toHaveBeenCalledWith('raw-token');
      expect(invites.accept).toHaveBeenCalledWith('hashed', 'joiner');
    });

    it('throws InvalidInviteError on an invalid or expired token', async () => {
      invites.accept.mockResolvedValue({ code: 'INVALID', householdId: null });
      await expect(sut.acceptInvite('joiner', 'bad')).rejects.toBeInstanceOf(InvalidInviteError);
    });

    it('throws HouseholdFullError when the household is full', async () => {
      invites.accept.mockResolvedValue({ code: 'FULL', householdId: 'hh-1' });
      await expect(sut.acceptInvite('joiner', 'raw-token')).rejects.toBeInstanceOf(HouseholdFullError);
    });

    it('returns the household summary on success and carries over the pool', async () => {
      invites.accept.mockResolvedValue({ code: 'OK', householdId: 'hh-1' });
      households.findForMember.mockResolvedValue(owned);
      households.memberCountForUser.mockResolvedValue(2);

      const result = await sut.acceptInvite('joiner', 'raw-token');

      expect(result).toEqual(owned);
      expect(carryOver.onMemberJoined).toHaveBeenCalledWith('hh-1', 2);
    });

    it('treats ALREADY_MEMBER as success without re-seeding the pool', async () => {
      invites.accept.mockResolvedValue({ code: 'ALREADY_MEMBER', householdId: 'hh-1' });
      households.findForMember.mockResolvedValue(owned);

      const result = await sut.acceptInvite('joiner', 'raw-token');

      expect(result).toEqual(owned);
      expect(carryOver.onMemberJoined).not.toHaveBeenCalled();
      expect(households.memberCountForUser).not.toHaveBeenCalled();
    });

    it('throws InvalidInviteError when the repo returns no household id', async () => {
      invites.accept.mockResolvedValue({ code: 'OK', householdId: null });
      await expect(sut.acceptInvite('joiner', 'raw-token')).rejects.toBeInstanceOf(InvalidInviteError);
    });

    it('throws HouseholdNotFoundError when the joined household cannot be read back', async () => {
      invites.accept.mockResolvedValue({ code: 'OK', householdId: 'hh-1' });
      households.findForMember.mockResolvedValue(null);

      await expect(sut.acceptInvite('joiner', 'raw-token')).rejects.toBeInstanceOf(HouseholdNotFoundError);
    });
  });
});
