import type { ITunableParameterStore } from '@core/ports/admin/ITunableParameterStore';
import type { IAdminAuditLog, AdminActor } from '@core/ports/admin/IAdminAuditLog';
import {
  QUOTA_PARAMS,
  findQuotaParam,
  normalizeQuotaValue,
  type QuotaKind,
} from '@core/domain/quotaConfig';
import type { UserRole } from '@core/ports/identity/IAppUserRepository';

export interface QuotaView {
  key: string;
  label: string;
  kind: QuotaKind;
  role: UserRole | null;
  value: string | null;
  allowUnlimited: boolean;
}

// Lists + edits the global per-role quota caps held in SSM (backs the runtime
// SsmUploadQuotaAdapter). Mirrors AdminConfigService; reuses the tunable store.
export class AdminQuotaConfigService {
  constructor(
    private readonly store: ITunableParameterStore,
    private readonly audit: IAdminAuditLog,
  ) {}

  async list(): Promise<QuotaView[]> {
    const values = await this.store.getValues(QUOTA_PARAMS.map((p) => p.ssmPath));
    return QUOTA_PARAMS.map((p) => ({
      key: p.key,
      label: p.label,
      kind: p.kind,
      role: p.role ?? null,
      value: values[p.ssmPath] ?? null,
      allowUnlimited: p.allowUnlimited,
    }));
  }

  // Validates + writes one quota cap, auditing the before/after value.
  // Throws UnknownAdminTargetError (unknown key) or InvalidAdminInputError (bad value).
  async update(actor: AdminActor, key: string, rawValue: unknown): Promise<string> {
    const param = findQuotaParam(key);
    const next = normalizeQuotaValue(param, rawValue);

    const before = (await this.store.getValues([param.ssmPath]))[param.ssmPath];
    await this.store.setValue(param.ssmPath, next);

    await this.audit.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: 'quota.config',
      target: param.key,
      before,
      after: next,
    });
    return next;
  }
}
