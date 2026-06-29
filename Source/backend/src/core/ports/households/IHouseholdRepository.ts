import type { UserRole } from '../identity/IAppUserRepository';

export interface HouseholdSummary {
  id: string;
  name: string;
  ownerUserId: string;
}

export interface HouseholdMember {
  userId: string;
  email: string;
  fullName: string;
  isOwner: boolean;
  uploadsThisWeek: number;
}

export interface HouseholdMembership {
  householdId: string;
  ownerUserId: string;
}

export interface IHouseholdRepository {
  countOwnedByUser(userId: string): Promise<number>;
  create(ownerUserId: string, name: string): Promise<string>;
  // The household the user belongs to (member or owner), or null when solo. RLS-scoped.
  findMembershipForUser(userId: string): Promise<HouseholdMembership | null>;
  // The owner's role for a household the caller belongs to (SECURITY DEFINER — a member
  // cannot read the owner's app_user row under RLS). Null when the caller is not a
  // member. Drives the owner-role-aware household pool cap (§2.4).
  getOwnerRole(householdId: string, userId: string): Promise<UserRole | null>;
  // Member count of the household, but only when `userId` is a member of it;
  // returns 0 for a non-member (the caller treats that as "no access"). Backed by
  // a SECURITY DEFINER function so it is safe to call before quota reservation.
  memberCountForUser(householdId: string, userId: string): Promise<number>;
  // Relies on RLS: returns the household only when the caller is a member or owner.
  findForMember(householdId: string): Promise<HouseholdSummary | null>;
  listMembers(householdId: string): Promise<HouseholdMember[]>;
  // Returns false when the caller is not the owner (or the target is the owner).
  removeMember(householdId: string, memberId: string, ownerId: string): Promise<boolean>;
  // Returns false when the caller is not the owner.
  disband(householdId: string, ownerId: string): Promise<boolean>;
  leave(householdId: string, userId: string): Promise<void>;
  // Pool activates (2nd member joins): seed the household HOUSEHOLD_CREDITS counter
  // from the owner's personal CREDITS for the week (§6.3 carry-over). SECURITY DEFINER
  // — the joining member cannot read the owner's counter under RLS. Idempotent overwrite.
  carryOverPoolOnActivate(householdId: string, weekStart: string): Promise<void>;
  // Pool deactivates (last member leaves / removed / disband): the owner re-absorbs the
  // pool's spend via GREATEST, so dissolving never wipes consumption. SECURITY DEFINER.
  settlePoolToOwner(householdId: string, weekStart: string): Promise<void>;
}
