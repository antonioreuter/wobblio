import type { IHouseholdRepository, HouseholdSummary } from '../../ports/households/IHouseholdRepository';
import type { IHouseholdInviteRepository } from '../../ports/households/IHouseholdInviteRepository';
import type { ISecureToken } from '../../ports/security/ISecureToken';
import type { IKmsEncryption } from '../../ports/security/IKmsEncryption';
import {
  HouseholdNotFoundError,
  NotHouseholdOwnerError,
  HouseholdFullError,
  InvalidInviteError,
} from '../../domain/errors';

const INVITE_TTL_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

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
  ) {}

  async createInvite(userId: string, householdId: string): Promise<IssuedInvite> {
    await this.requireOwner(userId, householdId);

    const raw = this.token.generate();
    const tokenEnc = await this.encryption.encrypt(raw);
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * DAY_MS).toISOString();

    const inviteId = await this.invites.create({
      householdId,
      createdByUserId: userId,
      tokenHash: this.token.hash(raw),
      tokenEnc,
      expiresAt,
    });

    return { inviteId, token: raw, expiresAt };
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
    return household;
  }

  private async requireOwner(userId: string, householdId: string): Promise<void> {
    const household = await this.households.findForMember(householdId);
    if (!household) throw new HouseholdNotFoundError(householdId);
    if (household.ownerUserId !== userId) throw new NotHouseholdOwnerError(householdId);
  }
}
