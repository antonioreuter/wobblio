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
  // Relies on RLS: returns the household only when the caller is a member or owner.
  findForMember(householdId: string): Promise<HouseholdSummary | null>;
  listMembers(householdId: string): Promise<HouseholdMember[]>;
  // Returns false when the caller is not the owner (or the target is the owner).
  removeMember(householdId: string, memberId: string, ownerId: string): Promise<boolean>;
  // Returns false when the caller is not the owner.
  disband(householdId: string, ownerId: string): Promise<boolean>;
  leave(householdId: string, userId: string): Promise<void>;
}
