import type { ITunableParameterStore } from '@core/ports/admin/ITunableParameterStore';
import type { IAdminAuditLog, AdminActor, AdminAuditRow } from '@core/ports/admin/IAdminAuditLog';
import { FEATURE_FLAGS, findFeatureFlag, isFlagEnabled } from '@core/domain/featureFlags';
import { InvalidAdminInputError } from '@core/domain/errors';

export interface FeatureFlagView {
  feature: string;
  label: string;
  enabled: boolean;
}

// Operator control of boolean feature flags (NF-01/05). Reuses the SSM tunable store and the
// admin audit log; the routing adapter (04) picks up a change within its TTL cache.
export class AdminFeatureToggleService {
  constructor(
    private readonly store: ITunableParameterStore,
    private readonly audit: IAdminAuditLog,
  ) {}

  async list(): Promise<FeatureFlagView[]> {
    const values = await this.store.getValues(FEATURE_FLAGS.map((f) => f.ssmPath));
    return FEATURE_FLAGS.map((f) => ({
      feature: f.feature,
      label: f.label,
      enabled: isFlagEnabled(values[f.ssmPath]),
    }));
  }

  // Validates the feature against the allowlist + the value as a boolean, writes 'true'/'false'
  // to SSM, and audits the before/after enabled state. Throws UnknownAdminTargetError (unknown
  // feature) or InvalidAdminInputError (non-boolean value).
  async toggle(actor: AdminActor, feature: string, value: unknown): Promise<boolean> {
    const flag = findFeatureFlag(feature);
    if (typeof value !== 'boolean') throw new InvalidAdminInputError('value must be a boolean');

    const before = isFlagEnabled((await this.store.getValues([flag.ssmPath]))[flag.ssmPath]);
    await this.store.setValue(flag.ssmPath, String(value));

    await this.audit.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: 'feature.toggle',
      target: flag.feature,
      before,
      after: value,
    });
    return value;
  }

  async history(limit: number): Promise<AdminAuditRow[]> {
    return this.audit.list('feature.toggle', limit);
  }
}
