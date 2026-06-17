export type AcceptInviteCode = 'OK' | 'ALREADY_MEMBER' | 'INVALID' | 'FULL';

export interface CreateInviteInput {
  householdId: string;
  createdByUserId: string;
  tokenHash: string;
  tokenEnc: string;
  expiresAt: string; // ISO 8601
}

export interface AcceptInviteResult {
  code: AcceptInviteCode;
  householdId: string | null;
}

export interface IHouseholdInviteRepository {
  create(input: CreateInviteInput): Promise<string>;
  // Returns false when no open invite matches (already revoked or unknown).
  revoke(householdId: string, inviteId: string): Promise<boolean>;
  accept(tokenHash: string, userId: string): Promise<AcceptInviteResult>;
}
