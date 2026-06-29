import type { IHouseholdRepository } from '../../ports/households/IHouseholdRepository';
import type { IUploadQuotaProvider } from '../../ports/quota/IUploadQuotaProvider';
import type { QuotaType } from '../../ports/quota/IQuotaRepository';
import type { UserRole } from '../../ports/identity/IAppUserRepository';
import { MIN_MEMBERS_FOR_POOL } from '../../domain/household';
import { effectiveHouseholdCap } from '../../domain/quotaConfig';

export interface UploadAllowance {
  // The user's household (member or owner), or null when solo — used to stamp the
  // invoice regardless of whether the shared pool is active.
  householdId: string | null;
  // True when the household pool (not the personal counter) backs this upload.
  isPool: boolean;
  counter: QuotaType;
  // The quota-counter key: household_id when pooled, else the user's tenant id.
  quotaOwnerId: string;
  // Weekly cap; Number.POSITIVE_INFINITY means unlimited.
  cap: number;
}

export interface AllowanceRequest {
  userId: string;
  role: UserRole;
}

// Single source of truth for "which upload quota applies to this user right now"
// (§2.4). Shared by the upload path (PresignService), the usage read (/me/usage),
// so enforcement and display can never drift apart. Must run inside the caller's
// tenant transaction — the household lookups are RLS-scoped to that user.
export class UploadAllowanceResolver {
  constructor(
    private readonly households: IHouseholdRepository,
    private readonly quotaProvider: IUploadQuotaProvider,
  ) {}

  async resolve({ userId, role }: AllowanceRequest): Promise<UploadAllowance> {
    const membership = await this.households.findMembershipForUser(userId);
    const householdId = membership?.householdId ?? null;

    const isPool = householdId !== null
      && (await this.households.memberCountForUser(householdId, userId)) >= MIN_MEMBERS_FOR_POOL;

    if (!isPool) {
      return {
        householdId,
        isPool: false,
        counter: 'CREDITS',
        quotaOwnerId: userId,
        cap: await this.quotaProvider.getPersonalUploadsCap(role),
      };
    }

    const cap = await this.householdPoolCap(householdId!, userId, role);
    return { householdId, isPool: true, counter: 'HOUSEHOLD_CREDITS', quotaOwnerId: householdId!, cap };
  }

  // The §2.4 household pool cap: follows the OWNER's role — an operator-role owner with an
  // unlimited personal cap lifts the whole pool to unlimited. Falls back to the caller's
  // role when the owner role can't be read (treated as a normal, capped owner). Shared by
  // resolve() and the household-detail read so the displayed cap can never drift from the
  // enforced one.
  async householdPoolCap(householdId: string, callerUserId: string, callerRole: UserRole): Promise<number> {
    const ownerRole = (await this.households.getOwnerRole(householdId, callerUserId)) ?? callerRole;
    const ownerPersonalCap = await this.quotaProvider.getPersonalUploadsCap(ownerRole);
    return effectiveHouseholdCap(ownerPersonalCap, await this.quotaProvider.getHouseholdUploadsCap());
  }
}
