import { InvalidAdminInputError, UnknownAdminTargetError } from '@core/domain/errors';

// The allowlist of runtime-tunable SSM parameters the admin console may edit.
// Anything not here is rejected — no arbitrary SSM path writes (admin-console 02).
// `key` is the flat, URL-safe identifier used in PUT /admin/config/{key}; `ssmPath`
// is the real parameter store path read by the runtime adapters.
export type TunableType = 'integer' | 'number' | 'boolean' | 'json';

export interface TunableParam {
  key: string;
  label: string;
  ssmPath: string;
  type: TunableType;
  min?: number;
  max?: number;
  sensitive?: boolean; // UI shows a confirmation modal for these
}

export const TUNABLE_PARAMS: readonly TunableParam[] = [
  {
    key: 'max_free_users_cap',
    label: 'Max free users (waitlist trigger)',
    ssmPath: '/wobblio/config/quotas/max_free_waitlist_cap',
    type: 'integer',
    min: 0,
    sensitive: true,
  },
  {
    key: 'routing_min_split_saving',
    label: 'Min split-route saving (€)',
    ssmPath: '/wobblio/config/routing/min_split_saving_eur',
    type: 'number',
    min: 0,
  },
  {
    key: 'routing_max_stores',
    label: 'Max stores in a split route',
    ssmPath: '/wobblio/config/routing/max_stores',
    type: 'integer',
    min: 1,
    max: 10,
  },
  {
    key: 'tags_vocabulary',
    label: 'Tag vocabulary (JSON)',
    ssmPath: '/wobblio/config/tags/vocabulary',
    type: 'json',
  },
  {
    key: 'tags_dedicated_call_enabled',
    label: 'Dedicated tag LLM call enabled',
    ssmPath: '/wobblio/config/tags/dedicated_call_enabled',
    type: 'boolean',
  },
  ...modelTokenCeilings(),
];

function modelTokenCeilings(): TunableParam[] {
  const roles = ['vision_parser', 'auxiliary', 'insight', 'embedder'] as const;
  return roles.map((role) => ({
    key: `model_max_tokens_${role}`,
    label: `Token ceiling — ${role}`,
    ssmPath: `/wobblio/config/models/limits/${role}_max_tokens`,
    type: 'integer' as const,
    min: 1,
  }));
}

export function findTunable(key: string): TunableParam {
  const param = TUNABLE_PARAMS.find((p) => p.key === key);
  if (!param) throw new UnknownAdminTargetError(key);
  return param;
}

// Validates `raw` against the param's type/bounds and returns the canonical string
// to persist in SSM (booleans → 'true'/'false', JSON → compact stringified form).
export function normalizeTunableValue(param: TunableParam, raw: unknown): string {
  if (param.type === 'boolean') return normalizeBoolean(raw);
  if (param.type === 'json') return normalizeJson(raw);
  return normalizeNumeric(param, raw);
}

function normalizeBoolean(raw: unknown): string {
  if (raw === true || raw === 'true') return 'true';
  if (raw === false || raw === 'false') return 'false';
  throw new InvalidAdminInputError('value must be a boolean');
}

function normalizeJson(raw: unknown): string {
  if (typeof raw === 'object' && raw !== null) return JSON.stringify(raw);
  if (typeof raw !== 'string') throw new InvalidAdminInputError('value must be JSON');
  try {
    return JSON.stringify(JSON.parse(raw));
  } catch {
    throw new InvalidAdminInputError('value must be valid JSON');
  }
}

function normalizeNumeric(param: TunableParam, raw: unknown): string {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) throw new InvalidAdminInputError('value must be a number');
  if (param.type === 'integer' && !Number.isInteger(n)) {
    throw new InvalidAdminInputError('value must be an integer');
  }
  if (param.min !== undefined && n < param.min) {
    throw new InvalidAdminInputError(`value must be ≥ ${param.min}`);
  }
  if (param.max !== undefined && n > param.max) {
    throw new InvalidAdminInputError(`value must be ≤ ${param.max}`);
  }
  return String(n);
}
