import type { IHouseholdRepository, HouseholdSummary } from '../../ports/households/IHouseholdRepository';
import type { IHouseholdInviteRepository } from '../../ports/households/IHouseholdInviteRepository';
import type { ISecureToken } from '../../ports/security/ISecureToken';
import type { IKmsEncryption } from '../../ports/security/IKmsEncryption';
import type { HouseholdCarryOverService } from './HouseholdCarryOverService';
import { mintShareToken } from '../../domain/shareToken';
import {
  HouseholdNotFoundError,
  NotHouseholdOwnerError,
  HouseholdFullError,
  InvalidInviteError,
} from '../../domain/errors';

const INVITE_TTL_DAYS = 7;

export interface IssuedInvite {
  inviteId: string;
  token: string; // raw token — returned once, never stored in the clear
  expiresAt: string;
}

export class HouseholdInviteService {
  constructor(
    private readonly households: IHouseholdRepository,
    private readonly invites: IHouseholdInviteRepository,
    private readonly token: ISecureToken,
    private readonly encryption: IKmsEncryption,
    private readonly carryOver: HouseholdCarryOverService,
  ) {}

  async createInvite(userId: string, householdId: string): Promise<IssuedInvite> {
    await this.requireOwner(userId, householdId);

    const minted = await mintShareToken(this.token, this.encryption, INVITE_TTL_DAYS);
    const inviteId = await this.invites.create({
      householdId,
      createdByUserId: userId,
      tokenHash: minted.tokenHash,
      tokenEnc: minted.tokenEnc,
      expiresAt: minted.expiresAt,
    });

    return { inviteId, token: minted.token, expiresAt: minted.expiresAt };
  }

  async revokeInvite(userId: string, householdId: string, inviteId: string): Promise<void> {
    await this.requireOwner(userId, householdId);
    const revoked = await this.invites.revoke(householdId, inviteId);
    if (!revoked) throw new InvalidInviteError('invite not found or already revoked');
  }

  async acceptInvite(userId: string, rawToken: string): Promise<HouseholdSummary> {
    const { code, householdId } = await this.invites.accept(this.token.hash(rawToken), userId);
    if (code === 'INVALID' || !householdId) throw new InvalidInviteError('token is invalid or expired');
    if (code === 'FULL') throw new HouseholdFullError(householdId);

    const household = await this.households.findForMember(householdId);
    if (!household) throw new HouseholdNotFoundError(householdId);

    // Only a fresh join can activate the pool — a re-accept (ALREADY_MEMBER) must not
    // re-seed and reset the pool mid-week.
    if (code === 'OK') {
      const memberCount = await this.households.memberCountForUser(householdId, userId);
      await this.carryOver.onMemberJoined(householdId, memberCount);
    }
    return household;
  }

  private async requireOwner(userId: string, householdId: string): Promise<void> {
    const household = await this.households.findForMember(householdId);
    if (!household) throw new HouseholdNotFoundError(householdId);
    if (household.ownerUserId !== userId) throw new NotHouseholdOwnerError(householdId);
  }
}
