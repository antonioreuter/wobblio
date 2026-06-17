import type { UserRole } from '@core/ports/identity/IAppUserRepository';

export const STANDARD_ACTIVE_LISTS = 3;
export const PREMIUM_ACTIVE_LISTS = 10;

// Active-list cap by role (§10): STANDARD gets 3, everyone else 10.
export function activeListLimit(role: UserRole): number {
  return role === 'STANDARD' ? STANDARD_ACTIVE_LISTS : PREMIUM_ACTIVE_LISTS;
}
