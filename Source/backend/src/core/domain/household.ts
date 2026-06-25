// Household sizing rules (Epic 09). The member cap is also enforced in SQL
// (accept_household_invite) — keep the two in sync when changing it.
export const MAX_HOUSEHOLD_MEMBERS = 3;

// The shared upload pool only activates once the household has more than one
// member; a solo owner draws from their personal quota instead.
export const MIN_MEMBERS_FOR_POOL = 2;
