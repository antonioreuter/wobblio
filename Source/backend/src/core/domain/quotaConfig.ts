import { InvalidAdminInputError, UnknownAdminTargetError } from '@core/domain/errors';
import type { UserRole } from '@core/ports/identity/IAppUserRepository';

// Global per-role quota caps the admin console may edit. These back the runtime
// SsmUploadQuotaAdapter; `key` is the URL-safe id used in PUT /admin/quotas/{key},
// `ssmPath` is the real Parameter Store path. A cap of -1 means "unlimited"
// (the adapter maps it to Infinity) — only roles flagged allowUnlimited accept it.
export type QuotaKind = 'uploads' | 'refunds' | 'household';

export interface QuotaParam {
  key: string;
  label: string;
  ssmPath: string;
  kind: QuotaKind;
  role?: UserRole; // absent for the shared household pool
  allowUnlimited: boolean;
}

const UNLIMITED = -1;

const PER_ROLE: { role: UserRole; allowUnlimited: boolean }[] = [
  { role: 'STANDARD', allowUnlimited: false },
  { role: 'PREMIUM', allowUnlimited: false },
  { role: 'TESTER', allowUnlimited: true },
  { role: 'ADMIN', allowUnlimited: true },
];

function roleParams(kind: 'uploads' | 'refunds'): QuotaParam[] {
  const suffix = kind === 'uploads' ? 'uploads_per_week' : 'failure_refunds_per_week';
  const noun = kind === 'uploads' ? 'weekly uploads' : 'weekly failure refunds';
  return PER_ROLE.map(({ role, allowUnlimited }) => ({
    key: `${role.toLowerCase()}_${suffix}`,
    label: `${role} — ${noun}`,
    ssmPath: `/wobblio/config/quotas/${role.toLowerCase()}_${suffix}`,
    kind,
    role,
    allowUnlimited,
  }));
}

export const QUOTA_PARAMS: readonly QuotaParam[] = [
  ...roleParams('uploads'),
  ...roleParams('refunds'),
  {
    key: 'household_uploads_per_week',
    label: 'Household — weekly uploads (shared pool)',
    ssmPath: '/wobblio/config/quotas/household_uploads_per_week',
    kind: 'household',
    allowUnlimited: false,
  },
];

// The shared household pool follows the owner's role (§2.4): an owner whose personal
// cap is unlimited (TESTER/ADMIN) lifts the whole household to unlimited; every other
// owner keeps the flat household cap. Cap inputs are already mapped (-1 → Infinity).
export function effectiveHouseholdCap(ownerPersonalCap: number, flatHouseholdCap: number): number {
  return Number.isFinite(ownerPersonalCap) ? flatHouseholdCap : Number.POSITIVE_INFINITY;
}

export function findQuotaParam(key: string): QuotaParam {
  const param = QUOTA_PARAMS.find((p) => p.key === key);
  if (!param) throw new UnknownAdminTargetError(key);
  return param;
}

// Validates `raw` as an integer cap and returns the canonical string to persist.
// allowUnlimited params accept -1 (unlimited); everything else floors at 0.
export function normalizeQuotaValue(param: QuotaParam, raw: unknown): string {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isInteger(n)) throw new InvalidAdminInputError('value must be an integer');

  const floor = param.allowUnlimited ? UNLIMITED : 0;
  if (n < floor) {
    const hint = param.allowUnlimited ? `${UNLIMITED} (unlimited)` : '0';
    throw new InvalidAdminInputError(`value must be ≥ ${hint}`);
  }
  return String(n);
}
