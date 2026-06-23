import type { ITunableParameterStore } from '@core/ports/admin/ITunableParameterStore';
import type { IAdminAuditLog, AdminActor } from '@core/ports/admin/IAdminAuditLog';
import {
  TUNABLE_PARAMS,
  findTunable,
  normalizeTunableValue,
  type TunableType,
} from '@core/domain/adminTunables';

export interface TunableView {
  key: string;
  label: string;
  type: TunableType;
  sensitive: boolean;
  value: string | null;
}

export class AdminConfigService {
  constructor(
    private readonly store: ITunableParameterStore,
    private readonly audit: IAdminAuditLog,
  ) {}

  async list(): Promise<TunableView[]> {
    const values = await this.store.getValues(TUNABLE_PARAMS.map((p) => p.ssmPath));
    return TUNABLE_PARAMS.map((p) => ({
      key: p.key,
      label: p.label,
      type: p.type,
      sensitive: Boolean(p.sensitive),
      value: values[p.ssmPath] ?? null,
    }));
  }

  // Validates + writes one allowlisted parameter, auditing the before/after value.
  // Throws UnknownAdminTargetError (unknown key) or InvalidAdminInputError (bad value).
  async update(actor: AdminActor, key: string, rawValue: unknown): Promise<string> {
    const param = findTunable(key);
    const next = normalizeTunableValue(param, rawValue);

    const before = (await this.store.getValues([param.ssmPath]))[param.ssmPath];
    await this.store.setValue(param.ssmPath, next);

    await this.audit.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: 'ssm.update',
      target: param.key,
      before,
      after: next,
    });
    return next;
  }
}
