import type {
  IHouseholdRepository,
  HouseholdSummary,
  HouseholdMember,
} from '../../ports/households/IHouseholdRepository';
import type { UserRole } from '../../ports/identity/IAppUserRepository';
import type { HouseholdCarryOverService } from './HouseholdCarryOverService';
import { hasPremiumAccess } from '../../domain/access';
import {
  PremiumRequiredError,
  AlreadyOwnsHouseholdError,
  InvalidHouseholdError,
  HouseholdNotFoundError,
  NotHouseholdOwnerError,
  OwnerCannotLeaveError,
} from '../../domain/errors';

export interface HouseholdDetail extends HouseholdSummary {
  members: HouseholdMember[];
}

export class HouseholdService {
  constructor(
    private readonly households: IHouseholdRepository,
    private readonly carryOver: HouseholdCarryOverService,
  ) {}

  // Create: PREMIUM only, max one owned household per user (Business Rules §09).
  async create(userId: string, role: UserRole, name: string): Promise<HouseholdSummary> {
    if (!hasPremiumAccess(role)) throw new PremiumRequiredError('households');

    const cleanName = name.trim();
    if (!cleanName) throw new InvalidHouseholdError('name is required');

    const owned = await this.households.countOwnedByUser(userId);
    if (owned > 0) throw new AlreadyOwnsHouseholdError(userId);

    const id = await this.households.create(userId, cleanName);
    return { id, name: cleanName, ownerUserId: userId };
  }

  async getDetail(householdId: string): Promise<HouseholdDetail> {
    const household = await this.requireMembership(householdId);
    const members = await this.households.listMembers(householdId);
    return { ...household, members };
  }

  // The caller's own household with its roster, or null when they are solo.
  // Used to populate the MEMBER-scope budget picker without a known household id.
  async getOwnHousehold(userId: string): Promise<HouseholdDetail | null> {
    const membership = await this.households.findMembershipForUser(userId);
    if (!membership) return null;
    return this.getDetail(membership.householdId);
  }

  async disband(userId: string, householdId: string): Promise<void> {
    // Ownership is checked up front (not just via the repo boolean) so the pool is
    // only settled for the real owner, while the household still exists for the read.
    const household = await this.requireMembership(householdId);
    if (household.ownerUserId !== userId) throw new NotHouseholdOwnerError(householdId);

    const memberCount = await this.households.memberCountForUser(householdId, userId);
    await this.carryOver.onDisband(householdId, memberCount);

    const ok = await this.households.disband(householdId, userId);
    if (!ok) throw new NotHouseholdOwnerError(householdId);
  }

  async removeMember(userId: string, householdId: string, memberId: string): Promise<void> {
    // Non-members get a 404 (as in disband/leave), not a 403 from the repo boolean.
    await this.requireMembership(householdId);
    const memberCountBefore = await this.households.memberCountForUser(householdId, userId);
    const ok = await this.households.removeMember(householdId, memberId, userId);
    if (!ok) throw new NotHouseholdOwnerError(householdId);
    await this.carryOver.onMemberRemoved(householdId, memberCountBefore);
  }

  async leave(userId: string, householdId: string): Promise<void> {
    const household = await this.requireMembership(householdId);
    if (household.ownerUserId === userId) throw new OwnerCannotLeaveError(householdId);

    const memberCountBefore = await this.households.memberCountForUser(householdId, userId);
    await this.households.leave(householdId, userId);
    await this.carryOver.onMemberRemoved(householdId, memberCountBefore);
  }

  private async requireMembership(householdId: string): Promise<HouseholdSummary> {
    const household = await this.households.findForMember(householdId);
    if (!household) throw new HouseholdNotFoundError(householdId);
    return household;
  }
}
