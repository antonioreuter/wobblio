import type { IHouseholdRepository } from '../../ports/households/IHouseholdRepository';
import { MIN_MEMBERS_FOR_POOL } from '../../domain/household';
import { weekStart } from '../../domain/week';

// Routes each §6.3 membership transition to its carry-over write for the current week.
// The arithmetic lives in the SECURITY DEFINER repo writes (copy on activate, GREATEST
// on settle) because both cross the owner↔household tenant boundary that RLS forbids the
// triggering user; this service only decides which one fires, from member counts.
export class HouseholdCarryOverService {
  constructor(
    private readonly households: IHouseholdRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  // Activate only on the 1→2 transition; a 3rd join leaves the pool untouched.
  async onMemberJoined(householdId: string, memberCount: number): Promise<void> {
    if (memberCount !== MIN_MEMBERS_FOR_POOL) return;
    await this.households.carryOverPoolOnActivate(householdId, this.currentWeekStart());
  }

  // Settle only when the drop crosses 2→1 (pass the count from before the removal).
  async onMemberRemoved(householdId: string, memberCountBefore: number): Promise<void> {
    if (memberCountBefore !== MIN_MEMBERS_FOR_POOL) return;
    await this.households.settlePoolToOwner(householdId, this.currentWeekStart());
  }

  // Settle whenever a pool was active (count before the disband at/above threshold).
  async onDisband(householdId: string, memberCountBefore: number): Promise<void> {
    if (memberCountBefore < MIN_MEMBERS_FOR_POOL) return;
    await this.households.settlePoolToOwner(householdId, this.currentWeekStart());
  }

  private currentWeekStart(): string {
    return weekStart(this.now().toISOString().slice(0, 10));
  }
}
