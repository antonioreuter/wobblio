import type { UserRole } from '../ports/identity/IAppUserRepository';

// Premium-gated features are also open to the elevated operator roles (ADMIN,
// TESTER), mirroring the upload-quota adapter which grants them unlimited
// capacity and the active-list cap which treats every non-STANDARD role as
// premium. Only STANDARD stays gated.
export function hasPremiumAccess(role: UserRole): boolean {
  return role !== 'STANDARD';
}
