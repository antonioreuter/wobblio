import { InvalidAdminInputError, UnknownAdminTargetError } from '@core/domain/errors';
import { BEDROCK_MAX_PDF_BYTES } from '@core/domain/pdf';
import type { UserRole } from '@core/ports/identity/IAppUserRepository';

// Global per-role quota caps the admin console may edit. These back the runtime
// SsmUploadQuotaAdapter; `key` is the URL-safe id used in PUT /admin/quotas/{key},
// `ssmPath` is the real Parameter Store path. A cap of -1 means "unlimited"
// (the adapter maps it to Infinity) — only roles flagged allowUnlimited accept it.
export type QuotaKind = 'uploads' | 'household' | 'upload_limit';

export interface QuotaParam {
  key: string;
  label: string;
  ssmPath: string;
  kind: QuotaKind;
  role?: UserRole; // absent for the shared household pool
  allowUnlimited: boolean;
  max?: number; // hard upper bound the admin cannot exceed (e.g. a Bedrock platform limit)
}

const UNLIMITED = -1;

const PER_ROLE: { role: UserRole; allowUnlimited: boolean }[] = [
  { role: 'STANDARD', allowUnlimited: false },
  { role: 'PREMIUM', allowUnlimited: false },
  { role: 'TESTER', allowUnlimited: true },
  { role: 'ADMIN', allowUnlimited: true },
];

// Per-role weekly upload caps. Failure-refund params were removed in 03 (success-only
// charging leaves nothing to refund), so this is the only per-role family left.
function uploadRoleParams(): QuotaParam[] {
  return PER_ROLE.map(({ role, allowUnlimited }) => ({
    key: `${role.toLowerCase()}_uploads_per_week`,
    label: `${role} — weekly uploads`,
    ssmPath: `/wobblio/config/quotas/${role.toLowerCase()}_uploads_per_week`,
    kind: 'uploads',
    role,
    allowUnlimited,
  }));
}

// Per-upload size/page limits (§06). Raw byte/page integers (not credits, never
// unlimited): the presign content-length-range and the worker-start page cap read these.
const UPLOAD_LIMIT_PARAMS: QuotaParam[] = [
  {
    key: 'max_image_bytes',
    label: 'Upload — max image size (bytes)',
    ssmPath: '/wobblio/config/quotas/max_image_bytes',
    kind: 'upload_limit',
    allowUnlimited: false,
  },
  {
    key: 'max_pdf_bytes',
    label: 'Upload — max PDF size (bytes)',
    ssmPath: '/wobblio/config/quotas/max_pdf_bytes',
    kind: 'upload_limit',
    allowUnlimited: false,
    // Bedrock rejects a larger document block, which would quarantine as a system fault.
    max: BEDROCK_MAX_PDF_BYTES,
  },
  {
    key: 'max_pdf_pages',
    label: 'Upload — max PDF pages',
    ssmPath: '/wobblio/config/quotas/max_pdf_pages',
    kind: 'upload_limit',
    allowUnlimited: false,
  },
];

export const QUOTA_PARAMS: readonly QuotaParam[] = [
  ...uploadRoleParams(),
  {
    key: 'household_uploads_per_week',
    label: 'Household — weekly uploads (shared pool)',
    ssmPath: '/wobblio/config/quotas/household_uploads_per_week',
    kind: 'household',
    allowUnlimited: false,
  },
  ...UPLOAD_LIMIT_PARAMS,
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
  if (param.max !== undefined && n > param.max) {
    throw new InvalidAdminInputError(`value must be ≤ ${param.max}`);
  }
  return String(n);
}
